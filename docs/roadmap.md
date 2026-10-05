# Feuille de route

## Questions métier ouvertes

1. Quels comptes/flux Pennylane sont des frais communs refacturables ?
2. Répartition sur HT ou TTC ?
3. Définition exacte de la période comptable ?
4. Règle d'entrée/sortie en cours de période (prorata temporis) ?
5. Règle de changement de stand ou de mètres linéaires en cours de période ?
6. Gestion des avoirs et régularisations ?
7. Clé de rapprochement fiable Pennylane → commerçant du portail ?
8. Niveau de détail visible par le commerçant ?

## Prochaines étapes

1. Brancher les sources du tableau de bord (Popina/Jalia, Skello, Pennylane, Notion) : la page
   `AdminDashboardPage` affiche aujourd'hui des données fictives (`features/admin/dashboard/mockDashboardData.ts`),
   à supprimer lors du branchement.
2. Remplacer les données de chiffre d'affaires codées en dur dans `RevenuePage` et `AdminRevenuePage`.
3. Ajouter des tests d'intégration RLS (isolation commerçant / personnel).
4. Migrer Tailwind 3 → 4 pour éliminer les alertes `npm audit` de la chaîne de build (outil de développement
   uniquement).
