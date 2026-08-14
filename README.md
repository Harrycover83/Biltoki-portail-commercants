# Portail Commerçants Biltoki

Base V1 pour un portail multi-halles (Toulon + extensible) avec React + TypeScript + Supabase.

## Analyse du repository existant

Le repository était initialement vide (README minimal), sans stack applicative, sans migration DB et sans tests.

## Architecture cible (V1)

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Auth / DB**: Supabase Auth + PostgreSQL + RLS
- **Déploiement**: Netlify (frontend), variables d'environnement Netlify
- **Comptabilité**: module d'intégration Pennylane côté serveur uniquement

```text
src/
  app/
  components/
  integrations/pennylane/
  lib/
  pages/
  supabase/
supabase/
  migrations/
```

## Questions métier bloquantes (à valider avant implémentation complète)

1. Quels comptes Pennylane sont considérés comme frais communs ?
2. Répartition sur montants HT ou TTC ?
3. Règle de prorata en cas d'arrivée/départ en cours de période ?
4. Gestion des changements de stand dans une période ?
5. Gestion des avoirs/régularisations ?
6. Clé de correspondance fiable commerçant Pennylane ↔ commerçant portail ?
7. Règles finales d'arrondi (au centime) si plusieurs postes/allocations ?

## Fonctionnel déjà posé

- Structure de routes commerçant + admin
- Guards d'authentification et de rôle (`merchant` / `admin`)
- Base UI dashboard commerçant/admin
- Module de calcul de répartition par mètres linéaires avec arrondi déterministe
- Tests métier ciblés sur le calcul
- Schéma Supabase complet (multi-halles) avec RLS strict
- Blocage des modifications de frais/répartitions sur période `closed`
- Squelette d'intégration Pennylane **server-side only**

## Sécurité

- Variables sensibles uniquement via environnement
- `.env` ignoré par git
- `.env.example` fourni
- RLS activé sur toutes les tables métier
- Isolation commerçant via `auth.uid()` + `profiles.merchant_id`

## Variables d'environnement

Voir `.env.example`.

## Démarrage

```bash
npm install
npm run dev
```

## Tests

```bash
npm run test
```

## Migrations Supabase

Migrations SQL dans `supabase/migrations`.
