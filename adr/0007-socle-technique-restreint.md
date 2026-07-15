# ADR-007 : Socle technique restreint et documenté plutôt qu'optimisation pièce par pièce

**Statut** : Proposé
**Date** : 2026-07-15
**Contraintes concernées** : C7 (maintenance), transverse à toutes les autres
**Tension liée** : T7 — voir [plan-architecture.md](../plan-architecture.md#t7)

## Contexte

Chacune des contraintes C1 à C6 tire naturellement vers un composant technique supplémentaire : un cache pour
la performance, une file pour les notifications, un moteur de recherche dédié pour la découverte, un service
d'authentification pour le MFA, un pipeline dédié pour l'analytique. Cumulés sans discipline, ces composants
dépassent ce qu'une équipe de 3 personnes peut exploiter durablement (C7).

## Options envisagées

| Option | Avantages | Inconvénients |
|---|---|---|
| **A. Meilleure techno pour chaque besoin indépendamment** (best-of-breed : Elasticsearch pour la recherche, service MFA dédié, message broker dédié…) | Chaque brique potentiellement la plus performante pour son usage isolé | Multiplie le nombre de technologies à opérer, sauvegarder, monitorer, mettre à jour — incompatible avec C7 ; chaque nouvelle techno est un point de compétence rare (bus factor) dans une équipe de 3 |
| **B. Socle restreint : une seule base de données, un seul cache, une seule file, un seul hébergeur ; extensions documentées en ADR** | Une équipe de 3 personnes peut raisonnablement opérer l'ensemble ; tout écart au socle est explicite, tracé et réversible plutôt qu'accumulé silencieusement | Certaines briques du socle sont « suffisantes » plutôt qu'« optimales » pour un usage isolé (ex. recherche PostgreSQL plutôt qu'Elasticsearch) |
| **C. Stack la plus populaire du marché, non évaluée par rapport aux contraintes du projet** | Facilité de recrutement perçue | Optimise pour la notoriété plutôt que pour C1/C2/C7 réels — même risque que A, sans le bénéfice de performance ciblée |

## Décision

Option **B** — c'est la traduction, au niveau du socle technique global, de toutes les décisions ADR-001 à
ADR-006 : chacune a par construction réutilisé une brique déjà choisie (PostgreSQL, Redis, la file intégrée au
framework, le conteneur applicatif unique) plutôt qu'introduit un nouveau composant. Tout écart futur à ce
socle doit être documenté par un nouvel ADR justifiant le besoin mesuré, pas supposé.

## Conséquences

**Positives**
- Charge opérationnelle proportionnée à la taille de l'équipe (3 personnes).
- Toute extension future est un choix explicite et documenté, pas une dérive progressive du système.

**Négatives (compromis assumé)**
- Performance ou fonctionnalités sous-optimales sur certains usages de niche par rapport à un outil
  spécialisé — accepté tant que les seuils de C2 (< 2s, 500 utilisateurs) restent respectés en test de charge.

## Révision

Si un module dépasse durablement les capacités du socle restreint — mesuré en phase de test de charge, pas
supposé a priori — documenter un nouvel ADR justifiant l'ajout d'une brique dédiée pour ce module précis.
