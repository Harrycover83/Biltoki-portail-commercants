# Base de données

La base est un PostgreSQL géré par Supabase, partagé entre le frontend (clé anon, RLS) et le backend (service role).

## Deux historiques de migrations

| Emplacement | Rôle | Outil |
|---|---|---|
| [`supabase/migrations/`](../supabase/migrations) | Schéma **de base** (tables, fonctions, allowlist `portal_access`) | `npm run db:migrate:remote`, `npm run db:run-sql` |
| [`backend/prisma/migrations/`](../backend/prisma/migrations) | **Source de vérité** actuelle : durcissement des accès, rôles, journal d'audit, etc. | `prisma migrate deploy` |

Les migrations Prisma supposent que le schéma de base Supabase est déjà en place. **Ne jamais initialiser une base
uniquement avec `supabase/migrations/`** : elles décrivent un état antérieur au durcissement (politiques permissives,
profils modifiables par leur titulaire). Les appliquer ensuite toutes les migrations Prisma.

Le modèle Prisma ([`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma)) décrit les tables du projet ; les
tables `auth.*` sont déclarées comme externes dans [`backend/prisma.config.ts`](../backend/prisma.config.ts).

### Migrations Prisma, dans l'ordre

1. `20260815124500_baseline` : état initial du modèle
2. `20260820000000_add_invoices_and_payments`, `20260904120000_add_service_charge_invoice_date`,
   `20260915130000_add_service_charge_supplier_name` : évolutions du modèle
3. `20261003160000_harden_access_control` : isolation des commerçants, profils verrouillés, plus d'accès anonyme
4. `20261004090000_add_role_values` : nouveaux rôles (valeurs d'enum validées avant utilisation)
5. `20261004090100_role_based_access` : périmètres par rôle, administration des comptes, journal
6. `20261005090000_audit_followups` : mot de passe provisoire verrouillé côté base, verrou « dernier administrateur »,
   révocation de sessions

Elles s'appliquent automatiquement au démarrage du backend (`npm start` lance `prisma migrate deploy`) ou à la main
avec `npm run prisma:deploy` dans `backend/` (variable `DATABASE_URL`). L'ancien rôle `admin` n'existe plus : ces
comptes sont convertis en `super_admin` par la migration.

### Faire évoluer le modèle

1. Modifier `backend/prisma/schema.prisma`.
2. `npm run prisma:migrate` dans `backend/` génère et applique la migration en local.
3. Relire le SQL généré (les policies RLS et fonctions ne sont pas déduites du modèle : les écrire à la main dans la
   migration), puis la committer.

## Données de référence et opérations ponctuelles

- `npm run prisma:seed` (dans `backend/`) crée l'organisation et les halles Biltoki et affiche la valeur de
  `HALLS_TO_SYNC`.
- [`supabase/seeds/`](../supabase/seeds) : scripts SQL ponctuels du pilote Toulon, à exécuter avec
  `npm run db:run-sql -- <fichier>`. `reset_pilot_toulon.sql` **supprime toutes les données métier** et ne conserve
  que les halles et le compte `admin.biltoki@example.com`.
- [`supabase/patches/`](../supabase/patches) : correctifs SQL ponctuels déjà intégrés au schéma.

Variables : `SUPABASE_DB_URL` (URL du pooler) pour les scripts racine, `DATABASE_URL` pour Prisma.

## Politique Auth

- Les tables `auth.*` sont gérées par Supabase Auth : ne jamais y insérer ni modifier directement via SQL. Utiliser le
  dashboard `Authentication > Users` ou l'API Admin Supabase (c'est ce que font le backend et `npm run portal:users`).
- Les tables à manipuler applicativement sont les tables `public.*` (`profiles`, `merchants`, `stands`,
  `service_charge_periods`, `service_charges`, `allocations`, etc.).
- Les seeds lisent `auth.users` pour lier les `profiles` mais n'y écrivent jamais.

## Tables principales

`organizations`, `halls`, `profiles`, `admin_hall_permissions`, `merchant_hall_permissions`, `merchants`, `stands`,
`service_charge_periods`, `allocation_rules`, `service_charges`, `allocations`, `invoices`, `payments`,
`pennylane_syncs`, ainsi que `portal_access` (allowlist des comptes, créée par la migration Supabase de base) et le
journal d'audit des comptes (`admin_audit_log`).

- Multi-halles natif, clés étrangères et index métier.
- `allocations` conserve des instantanés des valeurs historiques.
- Statuts de période : `draft`, `calculated`, `validated`, `closed` (un déclencheur protège les périodes `closed`).
