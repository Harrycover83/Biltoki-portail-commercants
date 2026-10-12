# Backend – Biltoki

API Node/Express du portail : synchronisation des charges communes depuis Pennylane, administration des comptes,
migrations de base de données (Prisma). Vue d'ensemble : [../docs/architecture.md](../docs/architecture.md).

## Démarrage

Prérequis : Node 22, un projet Supabase, un jeton Pennylane.

```bash
cd backend
cp .env.example .env     # puis renseigner les variables (voir .env.example, chaque variable y est documentée)
npm install
npm run db:setup         # applique les migrations Prisma et crée les halles
npm run dev
```

`npm run prisma:seed` affiche la valeur à copier dans `HALLS_TO_SYNC`.

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Démarrage avec rechargement (tsx) |
| `npm run build` / `npm start` | Compilation / migrations puis serveur compilé |
| `npm test` | Tests (Vitest) |
| `npm run lint` | ESLint (configuration partagée à la racine) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run pennylane:inspect` | Explore le compte Pennylane (société, catégories, factures) |
| `npm run popina:inspect` | Identifie l'établissement associé à la clé Popina, sans afficher la clé |
| `npm run prisma:*` | Studio, génération du client, migrations, seed |

## Structure

```text
src/
  main.ts            Point d'entrée : configuration, connexion, serveur, planificateur, arrêt propre
  config.ts          Lecture et validation des variables d'environnement
  server.ts          Assemblage de l'application Express
  scheduler.ts       Synchronisation planifiée (cron)
  auth/              Rôles et périmètres
  db/                Client Supabase (service role)
  middleware/        Authentification/autorisation, en-têtes de sécurité, CORS
  routes/            health, account, admin-users, service-charges, sync
  services/          Logique métier (sync Pennylane, gestion des comptes, politique de mot de passe, verrou de sync)
  integrations/      Client Pennylane
  utils/             Logger, récupération sécurisée de documents
  scripts/           Outils manuels (inspection Pennylane)
prisma/              Modèle, migrations, seed
```

## API

| Méthode & route | Accès | Rôle |
|---|---|---|
| `GET /health`, `GET /ready` | public | Sondes de vie / disponibilité (base atteignable) |
| `POST /api/sync/pennylane/:hallId` | personnel autorisé à synchroniser, sur ses halles ; jeton interne | Synchronise les 3 derniers mois |
| `POST /api/sync/pennylane/:hallId/backfill` | idem | Import complet de l'historique |
| `GET /api/sync/pennylane/:syncId` | `super_admin` ; jeton interne | Statut d'une synchronisation |
| `GET /api/halls`, `GET /api/sync/locks` | `super_admin` ; jeton interne | Halles configurées / synchronisations en cours |
| `GET /api/service-charges/:chargeId/document` | utilisateur ayant accès à la halle | Document source de la facture |
| `GET /api/popina/:hallId/revenue?since=AAAA-MM-JJ&until=AAAA-MM-JJ` | personnel connecté, sur ses halles ; siège inclus | CA TTC des clôtures et comparatif N-1 |
| `POST /api/account/password` | utilisateur connecté | Changement de mot de passe (y compris provisoire) |
| `/api/admin/*` | `super_admin` connecté (jamais le jeton interne) | Gestion des comptes et journal |

Authentification : `Authorization: Bearer <jeton Supabase>`, ou `x-internal-token` pour l'outillage d'exploitation.
Une synchronisation déjà en cours pour une halle renvoie `409`. Toutes les routes `/api` sont limitées à 300 requêtes
par minute et par IP (`429` au-delà ; `TRUST_PROXY_HOPS` doit refléter le nombre de reverse proxies). Les erreurs sont
toujours renvoyées en JSON, sans trace d'erreur.

## Synchronisation planifiée

`SYNC_CRON_SCHEDULE` (défaut `0 2 * * *`, soit 2 h chaque nuit) synchronise séquentiellement chaque halle de
`HALLS_TO_SYNC`. L'import est idempotent (mise à jour par `pennylane_id`, sans doublon). Pour être synchronisée, une
halle doit être associée à une catégorie analytique Pennylane : la halle de Toulon est déclarée dans
[`hall-categories.ts`](src/integrations/pennylane/hall-categories.ts), les autres via la variable
`PENNYLANE_HALL_CATEGORIES` (JSON, voir `.env.example`), sans modifier le code.

## Déploiement

L'image Docker ([`Dockerfile`](Dockerfile)) applique les migrations Prisma (`prisma migrate deploy`) puis démarre le
serveur ; `GET /health` sert de sonde. Renseigner les variables d'environnement de `.env.example` sur la plateforme
(Railway) et pointer `ALLOWED_ORIGINS` vers l'URL du portail.

## Popina : pilote Toulon

En local, le backend lit d'abord `.env.local`, puis `.env` (sans remplacer les variables déjà présentes
dans l'environnement du processus). Les deux fichiers sont ignorés par Git. Ne jamais utiliser de variable
`VITE_*` pour la clé Popina.

1. Enregistrer `POPINA_API_KEY` dans `backend/.env.local`.
2. Depuis `backend`, exécuter `npm run popina:inspect` ; vérifier le nom et la ville de l'établissement.
   Cette commande n'a pas besoin d'une configuration Supabase.
3. Enregistrer son identifiant dans `POPINA_LOCATION_ID`. `POPINA_HALL_ID` vaut l'UUID de Toulon par défaut
   (`29a1b758-07c9-481e-bd54-c72b6a9949c4`).
4. Pour démarrer le portail complet, renseigner aussi les variables Supabase et `HALLS_TO_SYNC` habituelles,
   puis démarrer le backend. Le frontend doit pointer `VITE_BACKEND_URL` sur ce backend.
5. En production, renseigner ces variables serveur dans Railway, puis déployer le backend et le frontend.
   Les fichiers locaux ne configurent pas le déploiement.

L'API officielle de production est `https://api.pragma-project.dev` (malgré son suffixe `.dev`), avec
authentification Bearer. Les montants sont en centimes TTC. Lecture seule, sans migration ni import en base.
Le CA ne représente que l'établissement couvert par la clé, pas tous les commerçants de la halle.

Le dashboard propose une période passée de 1 à 93 jours et compare les mêmes dates calendaires de N-1.
Les sessions sont affectées au jour de leur ouverture en heure de Paris. Les jours sans rapport ne valent
pas zéro ; la tendance porte uniquement sur les dates disponibles des deux côtés. Les autres sources et
le stock restent explicitement non connectés. Détails dans [l'architecture](../docs/architecture.md).

Erreurs explicites : `503` si la halle n'est pas configurée, `403` pour les commerçants ou une halle hors
périmètre, `400` pour une période invalide, `502` si Popina échoue ou renvoie des données incohérentes.

## Dépannage

- **`Missing environment variable`** : une variable obligatoire de `.env` est absente.
- **`No Pennylane mapping configured for hall …`** : la halle n'a pas de catégorie Pennylane (voir `PENNYLANE_HALL_CATEGORIES`).
- **`Pennylane API key is not configured`** : renseigner `PENNYLANE_API_KEY`.
- **Synchronisation qui ne démarre pas** : vérifier `SYNC_CRON_SCHEDULE` et les logs du backend.
