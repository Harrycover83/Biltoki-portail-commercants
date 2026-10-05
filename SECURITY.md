# Politique de sécurité

## Signaler une vulnérabilité

Ne publiez pas de vulnérabilité dans une issue publique. Utilisez le signalement privé de GitHub
(onglet **Security > Report a vulnerability** du dépôt) ou contactez directement l'équipe technique Biltoki.

Merci d'indiquer : le composant concerné, les étapes de reproduction et l'impact estimé. Un accusé de réception
est envoyé sous 3 jours ouvrés.

## Principes en place

- Authentification Supabase ; autorisations vérifiées côté base (RLS) **et** côté backend à chaque requête.
- Secrets uniquement côté serveur (`SUPABASE_SERVICE_ROLE_KEY`, `PENNYLANE_API_KEY`), jamais dans le dépôt.
- Content-Security-Policy, HSTS et en-têtes de durcissement sur le frontend et l'API.
- Limitation de débit sur l'API, téléchargements de documents restreints aux adresses publiques.
- Dépendances de production auditées en CI (`npm audit --audit-level=high`) et mises à jour par Dependabot.

Détails : [docs/architecture.md](docs/architecture.md#sécurité).
