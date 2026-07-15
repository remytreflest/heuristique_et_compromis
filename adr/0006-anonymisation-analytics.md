# ADR-006 : Anonymisation à la source plutôt que requêtes ad hoc

**Statut** : Proposé
**Date** : 2026-07-15
**Contraintes concernées** : C6 (analyse métier / RGPD)
**Tension liée** : T6 — voir [plan-architecture.md](../plan-architecture.md#t6)

## Contexte

Le brief exige que les données de rendez-vous puissent être agrégées à des fins statistiques sans exposer
d'informations personnelles. Le métier veut des statistiques (prestations populaires, pics de charge) ; la
contrainte interdit explicitement que ces agrégats exposent des données personnelles.

## Options envisagées

| Option | Avantages | Inconvénients |
|---|---|---|
| **A. Requêtes SQL ad hoc sur la base transactionnelle** | Rapide à mettre en place, aucun composant supplémentaire | Risque élevé d'exposition accidentelle de données personnelles ; chaque nouvelle requête redevient un risque RGPD à auditer individuellement |
| **B. Flux d'événements anonymisés vers un espace de reporting séparé, avec seuil de k-anonymat** | Les données personnelles ne transitent jamais vers l'espace de reporting (conformité *by design*, pas *by audit*) ; le seuil de k-anonymat évite la ré-identification par recoupement | Composant supplémentaire à maintenir (mitigé en le construisant comme une vue/projection de la base existante, pas un système séparé) ; perte de granularité individuelle |
| **C. Suppression de toute fonctionnalité analytique** | Aucun risque RGPD | Ignore un besoin métier explicite du brief (la contrainte C6 elle-même suppose que ces statistiques sont voulues) |

## Décision

Option **B**. Les événements envoyés au module Analytics ne contiennent ni identité ni coordonnées —
uniquement le type de prestation, le salon, et un créneau horaire arrondi (à l'heure, par exemple). Les
agrégats en dessous d'un seuil (typiquement 5 occurrences) ne sont pas restitués, afin d'éviter toute
ré-identification par recoupement (ex. « un seul client a pris une coloration à 22h dans ce salon »).

## Conséquences

**Positives**
- Conformité RGPD structurelle, indépendante de la vigilance de chaque développeur à chaque nouvelle requête.
- Le métier obtient ses statistiques sans exposition de données personnelles.

**Négatives (compromis assumé)**
- Impossibilité de répondre a posteriori à une question analytique nécessitant le détail individuel — compromis
  assumé et documenté, pas une limitation technique accidentelle.
- Le seuil de k-anonymat doit être calibré : trop bas, il expose un risque de ré-identification ; trop haut, il
  rend les statistiques peu exploitables pour les petits salons à faible volume.

## Révision

Si un salon a un volume d'activité trop faible pour dépasser le seuil de k-anonymat sur ses propres
statistiques, envisager une agrégation multi-salons ou une fenêtre temporelle plus large plutôt que
d'abaisser le seuil.
