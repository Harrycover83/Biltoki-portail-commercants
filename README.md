# Portail Commerçants – Biltoki

Application web destinée aux commerçants et aux équipes des Halles Biltoki : consultation des charges communes
(factures fournisseurs synchronisées depuis Pennylane), suivi du chiffre d'affaires et administration des comptes.

| Dossier | Contenu |
|---|---|
| [`src/`](src) | Frontend React + TypeScript (déployé sur Netlify) |
| [`backend/`](backend) | API Node/Express : synchronisation Pennylane, administration des comptes, migrations Prisma |
| [`supabase/`](supabase) | Schéma historique de base, seeds et correctifs ponctuels (voir [docs/database.md](docs/database.md)) |
| [`scripts/`](scripts) | Outils d'exploitation (provisioning des comptes, exécution SQL distante) |
| [`docs/`](docs) | Architecture, base de données, feuille de route |

## Stack

- **Frontend** : React 19, TypeScript strict, Vite, Tailwind CSS, Recharts, Vitest + Testing Library
- **Backend** : Node 22, Express, node-cron, Pino, Prisma (migrations), Vitest
- **Données & auth** : Supabase (PostgreSQL + Auth), RLS activée sur toutes les tables métier
- **Hébergement** : Netlify (frontend, SPA), Railway/Docker (backend)

## Démarrage rapide

Prérequis : Node 22 (`.nvmrc`).

```bash
npm install
cp .env.example .env      # renseigner les variables publiques (voir ci-dessous)
npm run dev
```

Variables du frontend (publiques uniquement – les secrets serveur vivent dans `backend/.env`) :

| Variable | Rôle |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé publique (anon) Supabase |
| `VITE_BACKEND_URL` | URL de l'API backend |

Le backend se lance séparément, voir [backend/README.md](backend/README.md).

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement Vite |
| `npm run build` | Typecheck + build de production |
| `npm run lint` | ESLint sur le frontend **et** le backend |
| `npm run typecheck` | Vérification TypeScript du frontend |
| `npm test` | Tests du frontend |
| `npm run check` | Lint + typecheck + tests |
| `npm run db:migrate:remote` | Applique la migration initiale Supabase (`SUPABASE_DB_URL`) |
| `npm run db:run-sql -- <fichier.sql>` | Exécute des fichiers SQL sur la base distante |
| `npm run portal:users` | Provisioning des comptes du portail depuis l'allowlist |

La CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) exécute lint, typecheck, tests et build pour le frontend et le backend.

## Organisation du frontend

```text
src/
  app/                 Routage et gardes d'accès (ProtectedRoute, RoleRoute)
  components/          Composants transverses (layout, ui)
  domain/              Logique métier pure et testée (calcul des répartitions)
  features/
    auth/              Session Supabase, connexion, changement de mot de passe
    merchant/          Pages et services côté commerçant
    admin/             Pages, composants et services côté équipes Biltoki
    common/            Pages partagées (404)
  lib/                 Utilitaires (env, formats, regroupements, supabase, rôles)
  types/               Types du domaine
```

Conventions : imports absolus via l'alias `@/` (= `src/`), un dossier par fonctionnalité, composants de page
dans `pages/`, composants réutilisables d'une fonctionnalité dans `components/`, accès aux données dans `services/`.

## Documentation

- [Architecture, rôles et sécurité](docs/architecture.md)
- [Base de données et migrations](docs/database.md)
- [Feuille de route et questions métier ouvertes](docs/roadmap.md)
- [Backend](backend/README.md)
