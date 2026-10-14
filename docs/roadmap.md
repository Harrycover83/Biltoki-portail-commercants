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

1. Valider le pilote Toulon (Popina, Pennylane compte pro / factures à approuver) puis l'étendre aux autres halles
   quand leurs clés seront disponibles. Connecter Skello dès que l'accès API est ouvert (le widget RH attend
   cet accès) et Notion. Les blocs non connectés n'affichent aucun montant inventé.
2. ~~Remplacer les données de chiffre d'affaires codées en dur~~ : fait. `/ca` (commerçants uniquement) stocke la
   déclaration mensuelle (`merchant_revenue_declarations`) et trace sa courbe ; `/admin/ca` liste les stands de la
   halle avec leur dernier CA saisi, puis un graphique par stand.
3. ~~Ajouter des tests d'intégration RLS~~ : fait (`backend/src/db/rls.test.ts`, PGlite). Compléter à chaque nouvelle table.
4. Migrer Tailwind 3 → 4 pour éliminer les alertes `npm audit` de la chaîne de build (outil de développement
   uniquement).
5. Mettre en place le suivi de stock à partir d'un inventaire physique daté, puis déduire les ventes Popina :
   mapping produits / recettes / unités, imports idempotents, règles d'annulation / retour et gestion des
   tickets fractionnés (`stockImpactIndicator`). Aucun stock théorique avant cette initialisation réelle.
