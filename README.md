# Portail Commercants - Biltoki

Application web metier pour les commercants des Halles Biltoki.

## Etat actuel

Ce repository contient une V1 technique executable avec:

- Frontend: React + TypeScript strict + Vite + Tailwind
- Authentification: Supabase Auth (login, logout, reset password)
- Autorisation: routes protegees + role `merchant` / `admin`
- Base de donnees: schema PostgreSQL multi-halles
- Securite: RLS activee sur toutes les tables metier
- Calcul metier: moteur d'allocation teste avec arrondi deterministe
- Deploiement: configuration Netlify SPA
- Pages merchant connectees aux donnees Supabase (plus de mock hardcode)

Important:

- L'integration Pennylane est scaffolded cote serveur, mais les appels API reels ne sont pas implementes.
- Aucun endpoint Pennylane n'a ete invente.

## Stack

- React 19
- TypeScript (strict)
- Vite
- Tailwind CSS
- Supabase JS client
- Vitest + Testing Library

## Architecture

```text
src/
  app/
    AppRouter.tsx
    guards/
      ProtectedRoute.tsx
      RoleRoute.tsx
  components/
    layout/
    ui/
  domain/
    allocation/
      calculateAllocations.ts
      calculateAllocations.test.ts
  features/
    auth/
    merchant/
    admin/
  integrations/
    pennylane/
  lib/
    env.ts
    money.ts
    supabase.ts
```

## Base de donnees Supabase

Fichiers:

- `supabase/schema.sql`
- `supabase/migrations/20260814124000_init.sql`
- `supabase/seeds/seed_minimal.sql`

Tables principales:

- `organizations`
- `halls`
- `profiles`
- `admin_hall_permissions`
- `merchants`
- `stands`
- `service_charge_periods`
- `allocation_rules`
- `service_charges`
- `allocations`
- `pennylane_syncs`

Points clefs:

- Multi-halles natif
- FK et index metier
- Snapshots d'allocation (`allocations`) conservant les valeurs historiques
- Statuts de periode: `draft`, `calculated`, `validated`, `closed`
- Trigger de protection en periode `closed`

## RLS et securite

- RLS activee sur toutes les tables metier
- `merchant`: acces strict a ses donnees
- `admin`: acces selon halles autorisees (`admin_hall_permissions`)
- Les calculs critiques sont cote base
- Les secrets ne sont jamais exposes au frontend

Variables serveur seulement:

- `SUPABASE_SERVICE_ROLE_KEY`
- `PENNYLANE_API_KEY`

## Calcul metier et arrondis

Moteur front/back de reference dans `src/domain/allocation/calculateAllocations.ts`:

- Entrees monetaires en centimes (entiers)
- Quote-part en basis points (bps)
- Distribution deterministe de l'ecart d'arrondi
- Somme allouee = somme a repartir (si total ml > 0)

Tests couverts:

- 4/20 = 20%, 6/20 = 30%, 10/20 = 50%
- 10 000 EUR x 20% = 2 000 EUR
- total metres lineaires = 0
- valeurs negatives interdites
- arrondis deterministes

## Authentification et routes

Routes publiques:

- `/login`
- `/reset-password`

Routes commercant (protegees):

- `/dashboard`
- `/frais`
- `/frais/:periodId`
- `/historique`
- `/profil`

Routes admin (protegees + role admin):

- `/admin/dashboard`
- `/admin/commercants`
- `/admin/stands`
- `/admin/frais`
- `/admin/periodes`
- `/admin/repartitions`
- `/admin/synchronisation`

## Integration Pennylane

Fichiers scaffoldes:

- `src/integrations/pennylane/client.ts`
- `src/integrations/pennylane/types.ts`
- `src/integrations/pennylane/sync.ts`
- `supabase/functions/pennylane-sync/index.ts`

Le code bloque volontairement l'execution tant que:

- la documentation officielle Pennylane n'est pas validee
- les mappings metier ne sont pas confirms

## Installation locale

1. Installer les dependances:

```bash
npm install
```

2. Creer `.env` depuis `.env.example` et renseigner:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PENNYLANE_API_KEY=
PENNYLANE_BASE_URL=
```

3. Lancer le frontend:

```bash
npm run dev
```

4. Qualite:

```bash
npm run typecheck
npm run test
npm run build
```

## Execution migration/seed a distance

Variables requises:

- `SUPABASE_DB_URL` (URL pooler recommandee)

Appliquer la migration initiale:

```bash
npm run db:migrate:remote
```

Executer un fichier SQL arbitraire (ex: seed):

```bash
npm run db:run-sql -- supabase/seeds/seed_minimal.sql
```

Important pour `seed_minimal.sql`:

- Remplacer `AUTH_USER_ID_MERCHANT` et `AUTH_USER_ID_ADMIN` avant execution.
- Creer les utilisateurs Auth correspondants dans Supabase avant le seed.

## Questions metier bloquantes (a trancher)

1. Quels comptes/flux Pennylane sont des frais communs refacturables ?
2. Repartition sur HT ou TTC ?
3. Quelle definition exacte de periode comptable ?
4. Regle en entree/sortie en cours de periode (prorata temporis) ?
5. Regle de changement de stand/ml en cours de periode ?
6. Regle de gestion des avoirs et regularisations ?
7. Cle de rapprochement fiable Pennylane -> merchant portail ?
8. Niveau de detail visible par le commercant ?

## Prochaines etapes recommandees

1. Brancher Supabase local/projet et appliquer la migration.
2. Implementer les repositories/services SQL (merchant dashboard + admin CRUD).
3. Connecter les pages aux donnees reelles et gerer les etats `loading/empty/error/success` complets.
4. Ajouter tests d'integration RLS (isolation merchant/admin).
5. Finaliser integration Pennylane apres validation documentaire officielle.
