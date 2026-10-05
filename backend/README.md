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
| `POST /api/account/password` | utilisateur connecté | Changement de mot de passe (y compris provisoire) |
| `/api/admin/*` | `super_admin` connecté (jamais le jeton interne) | Gestion des comptes et journal |

Authentification : `Authorization: Bearer <jeton Supabase>`, ou `x-internal-token` pour l'outillage d'exploitation.
Une synchronisation déjà en cours pour une halle renvoie `409`.

## Synchronisation planifiée

`SYNC_CRON_SCHEDULE` (défaut `0 2 * * *`, soit 2 h chaque nuit) synchronise séquentiellement chaque halle de
`HALLS_TO_SYNC`. L'import est idempotent (mise à jour par `pennylane_id`, sans doublon). Une halle doit être déclarée
dans la correspondance du [client Pennylane](src/integrations/pennylane/client.ts) pour être synchronisée.

## Déploiement

L'image Docker ([`Dockerfile`](Dockerfile)) applique les migrations Prisma (`prisma migrate deploy`) puis démarre le
serveur ; `GET /health` sert de sonde. Renseigner les variables d'environnement de `.env.example` sur la plateforme
(Railway) et pointer `ALLOWED_ORIGINS` vers l'URL du portail.

## Dépannage

- **`Missing environment variable`** : une variable obligatoire de `.env` est absente.
- **`No Pennylane mapping configured for hall …`** : la halle n'est pas déclarée dans le client Pennylane.
- **`Pennylane API key is not configured`** : renseigner `PENNYLANE_API_KEY`.
- **Synchronisation qui ne démarre pas** : vérifier `SYNC_CRON_SCHEDULE` et les logs du backend.
