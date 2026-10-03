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
- Page admin Graphiques: actualisation toutes les 15 secondes et au retour sur la fenetre, en arriere-plan sans masquer les graphiques ni reinitialiser les filtres. En cas d'erreur, les dernieres factures chargees restent affichees avec un message d'erreur.

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
  lib/
    env.ts
    money.ts
    supabase.ts
```

## Base de donnees Supabase

Fichiers:

- `supabase/schema.sql`
- `supabase/migrations/20260814124000_init.sql`
- `supabase/seeds/reset_pilot_toulon.sql`

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

## Roles et acces

| Role | Libelle | Perimetre | Droits |
|---|---|---|---|
| `merchant` | Commercant | son stand + charges communes de sa/ses halle(s) | lecture |
| `hall_manager` | Responsable de halle (manager, RX, capitaine) | exactement 1 halle | lecture seule |
| `network_manager` | Responsable reseau | les halles qui lui sont attribuees | lecture seule |
| `hq` | Siege | toutes les halles | lecture seule |
| `super_admin` | Administrateur total | toutes les halles | lecture + ecriture + gestion des comptes |

- Le perimetre d'un responsable de halle / reseau est stocke dans `admin_hall_permissions` (1 seule ligne pour `hall_manager`, imposee par la base).
- L'ancien role `admin` n'existe plus : les comptes `admin` ont ete convertis en `super_admin` par la migration.
- Seul le `super_admin` voit l'onglet **Administration** (`/admin/administration`) : creation, modification, desactivation, suppression des comptes, mot de passe provisoire, journal des actions. Cela passe par le backend (`/api/admin/*`, cle service role) ; aucune action n'est faite depuis le navigateur sur la base.
- Desactiver un compte coupe l'acces immediatement (verifie par la base a chaque requete, sans attendre l'expiration du jeton).
- La base garantit qu'il reste toujours au moins un `super_admin` actif.
- La synchronisation Pennylane (bouton de l'onglet Charges communes) est ouverte aux responsables de halle, responsables reseau et a l'administrateur total, **uniquement sur les halles de leur perimetre** (verifie par le backend). Le siege reste en lecture seule.

Les migrations d'acces sont des **migrations Prisma** (`backend/prisma/migrations/`) : elles s'appliquent automatiquement au demarrage du backend (`npm start` lance `prisma migrate deploy`), ou a la main avec `npm run prisma:deploy` dans `backend/` (variable `DATABASE_URL`). Dans l'ordre :

1. `20261003160000_harden_access_control` : isolation des commercants, profils verrouilles, plus d'acces anonyme
2. `20261004090000_add_role_values` : nouveaux roles (valeurs d'enum validees avant utilisation)
3. `20261004090100_role_based_access` : perimetres par role, administration des comptes, journal
4. `20261005090000_audit_followups` : mot de passe provisoire verrouille cote base, verrou « dernier administrateur », revocation de sessions

Le compte `admin` existant devient `super_admin` automatiquement. Ces migrations supposent que le schema Supabase de base (`supabase/migrations/2026081*`/`20260903*`: RLS, `portal_access`, fonctions) est deja en place.

## RLS et securite

- RLS activee sur toutes les tables metier (et deny-by-default pour toute table sans policy)
- `merchant`: acces strict a ses propres donnees (commercant, stands, repartitions, factures, paiements), plus les charges communes de sa/ses halle(s)
- `merchant`: ne peut jamais modifier `role`, `merchant_id` ou `email` de son profil (trigger + droits par colonne); seuls prenom/nom sont modifiables
- Responsables de halle / reseau / siege: lecture seule, limitee a leur perimetre (voir "Roles et acces")
- Aucun acces anonyme aux tables ni aux fonctions RPC
- Les roles se changent uniquement cote serveur (onglet Administration, `npm run portal:users`, cle service role ou dashboard SQL)
- Reference: `backend/prisma/migrations/20261003160000_harden_access_control` et `backend/prisma/migrations/20261004090100_role_based_access`
- Prerequis dashboard Supabase: desactiver l'inscription publique (Authentication > Providers > Email > "Allow new users to sign up") et fixer la longueur minimale des mots de passe a 12 (Authentication > Sign In / Providers > Password)
- Mot de passe provisoire: le drapeau `must_change_password` est dans `app_metadata` (ecrit uniquement par le serveur). Tant qu'il est actif, la base et le backend refusent tout acces; le changement passe par `POST /api/account/password` (politique de mot de passe appliquee cote serveur)
- Reinitialisation / desactivation d'un compte: ses sessions et jetons de rafraichissement sont revoques
- Scripts de base de donnees (`db:run-sql`, `db:migrate:remote`): certificat TLS verifie par defaut. Fournir le certificat Supabase avec `SUPABASE_DB_CA_FILE=<fichier.crt>` (Dashboard > Database > SSL Configuration)
- Le backend utilise `prisma` en version exacte (jamais `npx`) pour appliquer les migrations au demarrage
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
- `/admin/frais` (Charges communes + boutons de synchronisation Pennylane)
- `/admin/periodes`
- `/admin/repartitions`
- `/admin/synchronisation` (redirige vers `/admin/frais`)

## Integration Pennylane

L'integration Pennylane vit **uniquement dans le backend** (`backend/src/integrations/pennylane`, synchronisation planifiee + bouton de l'onglet Charges communes). La cle Pennylane n'est jamais exposee au navigateur.

## Installation locale

1. Installer les dependances:

```bash
npm install
```

2. Creer `.env` depuis `.env.example` et renseigner (variables publiques uniquement; les secrets serveur vont dans `backend/.env`):

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BACKEND_URL=
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

Executer un fichier SQL arbitraire (ex: reset pilote):

```bash
npm run db:run-sql -- supabase/seeds/reset_pilot_toulon.sql
```

Important pour `reset_pilot_toulon.sql`:

- Supprime toutes les donnees metier de test et ne conserve que les halles Prisma et le compte `admin.biltoki@example.com`.
- Ne touche pas a `auth.users`: supprimer les comptes de test restants depuis le dashboard Supabase.
- Ne pas inserer ou modifier directement `auth.users`, `auth.identities` ou `auth.instances` via SQL. Utiliser uniquement:
  - le dashboard `Authentication > Users`
  - ou l'API Admin officielle Supabase

## Politique Auth

- Les tables `auth.*` sont gerees par Supabase Auth et ne doivent pas etre traitees comme des tables metier.
- Les tables du projet a manipuler applicativement sont les tables `public.*` (`profiles`, `merchants`, `stands`, `service_charge_periods`, `service_charges`, `allocations`, etc.).
- Le seed metier lit `auth.users` pour lier les `profiles`, mais n'ecrit jamais dans `auth.*`.

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
