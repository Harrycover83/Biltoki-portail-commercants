# Architecture

```text
Navigateur (React)
   │  Supabase JS (clé anon, RLS)            lecture des données du périmètre de l'utilisateur
   │  fetch + jeton d'accès                   actions privilégiées
   ▼
Backend Express ──► Supabase (clé service role)  écriture, administration des comptes
   │
   └──► Pennylane API (clé serveur uniquement)   factures fournisseurs
   └──► Popina API (clé serveur uniquement)      CA des clôtures, comparatif N-1
```

- Le navigateur lit les données directement dans Supabase ; la **RLS** garantit l'isolation par rôle et par halle.
- Toute action privilégiée (synchronisation Pennylane, gestion des comptes, changement de mot de passe provisoire,
  ouverture d'un document source) passe par le **backend**, qui revérifie le rôle à chaque requête.
- Les secrets (`SUPABASE_SERVICE_ROLE_KEY`, `PENNYLANE_API_KEY`, `POPINA_API_KEY`) ne sont jamais exposés au navigateur.

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

- `/admin/dashboard` – CA Popina réel et comparatif N-1, autres sources explicitement non connectées
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

## Intégration Popina (pilote Toulon)

Les chiffres, alertes, tâches et stocks fictifs du dashboard ont été supprimés ; aucun seed ni donnée métier de
la base n'est supprimé. Les autres pages de CA historiques restent hors du périmètre de ce branchement.

- Documentation officielle : [guides](https://developer.popina.com/docs/guides) et
  [rapports](https://developer.popina.com/docs/api/reports/get-reports-V1).
- Lecture via `GET /api/popina/:hallId/revenue/daily?since=AAAA-MM-JJ&until=AAAA-MM-JJ` (CA TTC par jour, `null`
  quand aucun rapport n'existe) et `GET /api/popina/:hallId/revenue` (comparatif N‑1 à dates identiques),
  authentifiées avec le jeton
  Supabase. Les commerçants et le jeton machine sont refusés. Le siège et le super admin lisent toutes les
  halles ; responsables de halle / réseau limités à `admin_hall_permissions`.
- Le dashboard affiche une carte « CA de la veille » ; un clic permet de choisir un jour ou une semaine. Les
  tendances sont calculées sur les **semaines calendaires ISO** (lundi → dimanche) : semaine choisie contre la même
  semaine de N‑1 (même numéro, repli sur la semaine 52 si la 53 n'existe pas) et contre la semaine précédente,
  jour par jour (par jour de semaine). Seules les semaines **complètes** sont proposées (jamais la semaine en cours),
  tout comme la carte du jour n'affiche que des jours clôturés ; un jour
  sans rapport n'est jamais compté comme zéro.
- Une clé Popina couvre un établissement. `POPINA_HALL_ID` désigne la halle du portail (Toulon par défaut) et
  `POPINA_LOCATION_ID` l'établissement Popina, vérifié sur chaque rapport. Une autre halle ne réutilise jamais
  la clé Toulon ; elle affiche « non configuré ». Ce CA est celui des caisses de cet établissement, pas la
  somme des CA de tous les commerçants de la halle.
- Les rapports sont lus à la demande, sans écriture en base, avec pagination complète et délai plafonné.
  Une erreur, une réponse partielle, un doublon ou une mauvaise correspondance d'établissement bloque
  l'affichage des montants au lieu de produire un total trompeur.
- Montants TTC en centimes, sessions rattachées au jour de leur **ouverture**, fuseau `Europe/Paris`.
  Période de 1 à 93 jours, jusqu'à hier inclus ; la période par défaut est le mois à date jusqu'à hier
  (le premier du mois, le mois précédent). Ce n'est pas du temps réel et une caisse non clôturée n'est pas
  encore comptabilisée.
- N-1 = mêmes dates calendaires, pas mêmes jours de semaine. Un jour sans rapport est indisponible, pas zéro.
  Dans le tableau quotidien, un lundi de Toulon sans rapport est libellé « Fermé · lundi » (fermeture
  hebdomadaire confirmée) ; les autres jours sans rapport sont libellés « Données non remontées ».
  Cette distinction vaut aussi pour N-1, sans modifier les montants ni les calculs. Un lundi avec un
  rapport affiche toujours son CA réel ; les autres halles ne sont pas supposées fermées le lundi.
  Les totaux sont ceux des rapports disponibles, avec couverture en jours affichée ; la tendance utilise
  seulement les jours présents dans les deux années. Pas de pourcentage si le CA N-1 comparable est nul
  ou négatif. Le 29 février reste sans comparaison s'il n'existe pas en N-1, sans dupliquer le 28 février.
- Les données d'une ancienne halle ou période disparaissent immédiatement lors d'un changement de sélection.
- Le dashboard présente les totaux, la tendance N-1 et le tableau quotidien, sans graphique.
- Stock : aucun calcul ni inventaire fictif. L'étape suivante nécessitera un inventaire physique daté,
  un mapping produits / recettes / unités, et des mouvements de stock idempotents. Les tickets fractionnés
  doivent respecter `stockImpactIndicator` ; annulations, retours et transferts nécessitent des règles métier
  validées ([cas particuliers Popina](https://developer.popina.com/docs/guides/edge-cases)).
