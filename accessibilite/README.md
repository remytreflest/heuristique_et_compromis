# Outillage d'audit d'accessibilité

Scanner [axe-core](https://github.com/dequelabs/axe-core) piloté par Playwright, contre le prototype
`docker-compose` réellement démarré. Utilisé pour produire [rapport-rgaa.md](rapport-rgaa.md). N'est pas
une dépendance de l'application (`prototype/`) — un outil d'audit séparé.

## Lancer le scan

Le prototype doit tourner (`docker compose up` depuis la racine du dépôt), puis :

```bash
npm install
npx playwright install chromium
BASE_URL=http://localhost:3001 node axe-scan.mjs
```

Résultats détaillés dans `results/*.json` (non versionnés — reproductibles), résumé dans
`results/summary.json`. Écrans couverts et logique de sélection : voir [axe-scan.mjs](axe-scan.mjs) et
la section « Méthode » de [rapport-rgaa.md](rapport-rgaa.md).
