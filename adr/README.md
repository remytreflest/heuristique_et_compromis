# Architecture Decision Records

Registre des décisions d'architecture de la plateforme de prise de rendez-vous en salon de coiffure. Chaque
ADR formalise une tension identifiée dans [plan-architecture.md](../plan-architecture.md) : le conflit entre
contraintes, les options réellement comparées, la décision retenue et le compromis assumé en échange.

Ce registre constitue la matière première de la section « Choix d'architecture (avec heuristiques et
compromis) » du dossier d'architecture logicielle.

| ADR | Décision | Contraintes | Tension |
|-----|----------|-------------|---------|
| [0001](0001-monolithe-modulaire.md) | Monolithe modulaire plutôt que microservices | C1, C7 | T1 |
| [0002](0002-cache-cdn-async.md) | Cache, CDN et traitement asynchrone plutôt que sur-provisionnement | C2, C1 | T2 |
| [0003](0003-mfa-accessible.md) | WebAuthn/TOTP plutôt qu'une solution MFA générique | C3 | T3 |
| [0004](0004-pwa-offline-first.md) | PWA offline-first plutôt que dépendance réseau stricte | C4, F3 | T4 |
| [0005](0005-i18n-rtl.md) | CSS logique + i18n par clés plutôt que gabarits par langue | C5, C7 | T5 |
| [0006](0006-anonymisation-analytics.md) | Anonymisation à la source plutôt que requêtes ad hoc | C6 | T6 |
| [0007](0007-socle-technique-restreint.md) | Socle technique restreint et documenté | C7 (transverse) | T7 |

## Statut

Toutes les ADR sont au statut **Proposé** : elles forment une base de travail à valider en équipe avant
rédaction finale du dossier d'architecture, pas des décisions figées. Chaque ADR porte une section
**Révision** qui précise la condition concrète (mesurée, pas supposée) qui justifierait de rouvrir le choix.

## Convention

Format inspiré du modèle Nygard, complété d'un tableau d'options comparées (Avantages / Inconvénients) pour
garder trace du raisonnement heuristiques-et-compromis, et d'une section Révision pour expliciter les
conditions de remise en cause. Numérotation séquentielle, un fichier par décision, jamais réécrit après coup
— une décision remplacée donne lieu à une nouvelle ADR qui référence l'ancienne.
