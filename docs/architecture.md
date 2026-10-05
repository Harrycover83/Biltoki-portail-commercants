# Architecture

```text
Navigateur (React)
   │  Supabase JS (clé anon, RLS)            lecture des données du périmètre de l'utilisateur
   │  fetch + jeton d'accès                   actions privilégiées
   ▼
Backend Express ──► Supabase (clé service role)  écriture, administration des comptes
   │
   └──► Pennylane API (clé serveur uniquement)   factures fournisseurs
```

- Le navigateur lit les données directement dans Supabase ; la **RLS** garantit l'isolation par rôle et par halle.
- Toute action privilégiée (synchronisation Pennylane, gestion des comptes, changement de mot de passe provisoire,
  ouverture d'un document source) passe par le **backend**, qui revérifie le rôle à chaque requête.
- Les secrets (`SUPABASE_SERVICE_ROLE_KEY`, `PENNYLANE_API_KEY`) ne sont jamais exposés au navigateur.

## Rôles et accès

| Rôle | Libellé | Périmètre | Droits |
|---|---|---|---|
| `merchant` | Commerçant | son stand + charges communes de sa/ses halle(s) | lecture |
| `hall_manager` | Responsable de halle (manager, RX, capitaine) | exactement 1 halle | lecture + synchronisation |
| `network_manager` | Responsable réseau | les halles qui lui sont attribuées | lecture + synchronisation |
| `hq` | Siège | toutes les halles | lecture seule |
| `super_admin` | Administrateur total | toutes les halles | lecture + écriture + gestion des comptes |

- Le périmètre des responsables de halle / réseau est stocké dans `admin_hall_permissions` (une seule ligne pour
  `hall_manager`, imposée par la base).
- Seul le `super_admin` accède à l'onglet **Administration** (`/admin/administration`) : création, modification,
  désactivation, suppression des comptes, mot de passe provisoire, journal des actions.
- Désactiver un compte coupe l'accès immédiatement (vérifié à chaque requête, sans attendre l'expiration du jeton).
- La base garantit qu'il reste toujours au moins un `super_admin` actif.
- La synchronisation Pennylane est ouverte aux responsables de halle, responsables réseau et au `super_admin`,
  **uniquement sur les halles de leur périmètre** (vérifié par le backend). Le siège reste en lecture seule.

La logique des rôles est dupliquée côté frontend ([`src/lib/roles.ts`](../src/lib/roles.ts)) et backend
([`backend/src/auth/roles.ts`](../backend/src/auth/roles.ts)) : les deux doivent évoluer ensemble.

## Sécurité

- RLS activée sur toutes les tables métier (deny-by-default pour toute table sans policy), aucun accès anonyme.
- Un commerçant ne peut jamais modifier `role`, `merchant_id` ou `email` de son profil ; seuls prénom/nom sont modifiables.
- Les rôles ne se changent que côté serveur (onglet Administration, `npm run portal:users`, clé service role ou SQL).
- Mot de passe provisoire : le drapeau `must_change_password` est dans `app_metadata` (écrit uniquement par le
  serveur). Tant qu'il est actif, la base et le backend refusent tout accès ; le changement passe par
  `POST /api/account/password` (politique de mot de passe appliquée côté serveur).
- Réinitialiser ou désactiver un compte révoque ses sessions et jetons de rafraîchissement.
- Prérequis dashboard Supabase : désactiver l'inscription publique (Authentication > Providers > Email >
  « Allow new users to sign up ») et fixer la longueur minimale des mots de passe à 12.
- Scripts SQL distants : certificat TLS vérifié par défaut ; fournir le certificat Supabase avec
  `SUPABASE_DB_CA_FILE=<fichier.crt>` (Dashboard > Database > SSL Configuration).
- Frontend : Content-Security-Policy générée au build (`vite.config.ts`) à partir de `VITE_SUPABASE_URL` et
  `VITE_BACKEND_URL` (seules ces origines sont autorisées pour les appels réseau), polices auto-hébergées, en-têtes
  HSTS / `X-Frame-Options` / COOP dans `netlify.toml`.
- API : limitation à 300 requêtes/min/IP, erreurs toujours en JSON sans trace, middlewares asynchrones protégés
  (`asyncHandler`), en-têtes de sécurité et CORS restreint aux origines configurées.
- Téléchargement des justificatifs : HTTPS uniquement, redirections revalidées, taille et durée plafonnées, et
  résolution DNS vérifiée **à la connexion** (toute adresse privée, loopback ou link-local est refusée, y compris
  via un nom de domaine public pointant vers une IP interne).
- Dépendances : `npm audit` des dépendances de production exécuté en CI, mises à jour hebdomadaires par Dependabot.
  Le backend épingle des versions corrigées de sous-dépendances de la CLI Prisma via `overrides`
  (`mysql2`, `deepmerge-ts`) ; à retirer lorsque Prisma les embarquera. Les alertes restantes concernent uniquement
  des outils de développement (chaîne de build Tailwind 3, Vitest) sans exposition en production.
- Signalement d'une vulnérabilité : voir [SECURITY.md](../SECURITY.md).

## Routes du frontend

Publiques : `/login`.

Authentifiées : `/historique`, `/ca`, `/profil`, `/security/update-password`. La racine `/` et `/dashboard`
redirigent vers la page d'accueil du rôle (`/historique` pour un commerçant, `/admin/dashboard` pour le personnel).

Personnel Biltoki (`hall_manager`, `network_manager`, `hq`, `super_admin`) :

- `/admin/dashboard` – tableau de bord (aperçu avec données fictives)
- `/admin/frais` – charges communes : factures, comparateur de périodes et historique par fournisseur, synchronisation Pennylane
- `/admin/ca` – chiffre d'affaires

`super_admin` uniquement : `/admin/administration`.

Anciennes URL conservées en redirection : `/frais`, `/frais/:periodId`, `/admin/commercants`,
`/admin/repartitions`, `/admin/synchronisation`, `/admin/graphiques`.

## Intégration Pennylane

L'intégration vit **uniquement dans le backend** ([`backend/src/integrations/pennylane`](../backend/src/integrations/pennylane)),
via la synchronisation planifiée et le bouton de l'onglet Charges communes. Le jeton Pennylane est limité à une
société ; la correspondance halle → catégorie analytique Pennylane est déclarée dans le client. Sans clé API, toute
synchronisation échoue explicitement (aucune donnée fictive n'est jamais écrite en base).

## Calcul des répartitions

[`src/domain/allocation/calculateAllocations.ts`](../src/domain/allocation/calculateAllocations.ts) :

- montants en centimes (entiers), quote-part en points de base (bps) ;
- distribution déterministe de l'écart d'arrondi ;
- somme allouée = somme à répartir (si le total de mètres linéaires est > 0).
