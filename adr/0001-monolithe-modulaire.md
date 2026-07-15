# ADR-001 : Monolithe modulaire plutôt que microservices

**Statut** : Proposé
**Date** : 2026-07-15
**Contraintes concernées** : C1 (déploiement), C7 (maintenance)
**Tension liée** : T1 — voir [plan-architecture.md](../plan-architecture.md#t1)

## Contexte

Le brief exige un hébergement mutualisé peu coûteux aujourd'hui, migrable vers le cloud (AWS/Azure) plus tard
« sans refonte majeure », et une équipe de 3 personnes pour maintenir l'ensemble avec un minimum de dépendances
techniques. Ces deux exigences excluent d'office les architectures qui supposent une infrastructure distribuée
sophistiquée pour fonctionner correctement.

## Options envisagées

| Option | Avantages | Inconvénients |
|---|---|---|
| **A. Microservices + orchestration (Kubernetes)** | Isolation et scaling indépendant par domaine ; panne d'un service sans effet sur les autres | Orchestration = compétence rare, absente d'une équipe de 3 ; coût opérationnel élevé (monitoring distribué, tracing, service mesh) ; incompatible avec un mutualisé bas coût en phase 1 |
| **B. Monolithe modulaire 12-factor, conteneurisé** | Un seul déploiement, un seul pipeline CI/CD ; compatible mutualisé dès le jour 1 ; modules à bornes claires préparent une extraction future si un besoin réel apparaît ; image de conteneur portable vers le cloud sans réécriture | Pas de scaling indépendant par module ; discipline de code requise pour éviter le couplage entre modules |
| **C. Serverless (functions) dès le départ** | Scalabilité automatique, coût à l'usage | Fort vendor lock-in (contredit C1 : refonte nécessaire au changement de cloud) ; cold starts pouvant nuire à C2 (< 2s) ; débogage/tests locaux plus complexes pour une petite équipe |

## Décision

Option **B**. Le monolithe modulaire est le seul choix qui satisfait simultanément C1 (portabilité sans
réécriture), C2 (latence prévisible, pas de cold start) et C7 (une équipe de 3 personnes peut le maintenir
seule). L'application est structurée en modules à bornes claires — Identité & Auth, Agenda & Réservation,
Recherche & Découverte, Notifications, i18n & Contenu, Analytics — sans état partagé mutable entre eux, et
empaquetée dans une image de conteneur unique dès le développement, même si l'hébergeur initial ne l'exécute
pas nativement.

## Conséquences

**Positives**
- Time-to-market plus rapide : pas d'overhead d'infrastructure distribuée à opérer.
- Coûts d'hébergement maîtrisés en phase 1 (un seul serveur/conteneur).
- Base de code unique, onboarding facilité si l'équipe s'agrandit.
- La même image de conteneur sert de contrat de portabilité vers la phase 2 (cloud).

**Négatives (compromis assumé)**
- Montée en charge future limitée au scaling vertical avant la migration cloud.
- Risque de « monolithe boueux » si la discipline de modularité (bornes entre modules) n'est pas maintenue
  dans la durée.

## Révision

À reconsidérer si un module (par exemple Recherche) présente une charge ou une fréquence de déploiement
durablement différente des autres modules, mesurée en phase de test de charge — ou si l'équipe dépasse
significativement 3 personnes.
