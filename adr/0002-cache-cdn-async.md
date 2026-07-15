# ADR-002 : Cache, CDN et traitement asynchrone plutôt que sur-provisionnement

**Statut** : Proposé
**Date** : 2026-07-15
**Contraintes concernées** : C2 (performance), C1 (déploiement)
**Tension liée** : T2 — voir [plan-architecture.md](../plan-architecture.md#t2)

## Contexte

Le brief exige un temps de réponse < 2s pour 500 utilisateurs simultanés lors de pics ponctuels (ouverture de
créneaux avant les fêtes), tout en restant hébergé sur un serveur mutualisé peu coûteux. Sur-dimensionner en
continu pour absorber un pic ponctuel gaspille le budget d'hébergement le reste de l'année.

## Options envisagées

| Option | Avantages | Inconvénients |
|---|---|---|
| **A. Sur-dimensionner le serveur** | Simple à mettre en œuvre | Coût récurrent élevé pour un besoin ponctuel ; ne résout pas la latence des opérations synchrones non critiques |
| **B. Cache (Redis) + CDN + traitement asynchrone des tâches non critiques** | Coût proportionné à l'usage réel ; CDN protège aussi contre les pics de trafic ; découplage des notifications améliore le temps de réponse perçu sur l'action critique | Complexité d'invalidation de cache ; ajoute une file de messages comme composant (mitigé en ADR-007 : réutilisation de la file intégrée au framework) |
| **C. Ne rien optimiser, attendre la migration cloud** | Aucun effort en phase 1 | Risque direct de non-conformité à C2 lors des pics identifiés dans le brief ; reporte un problème connu plutôt que de le traiter |

## Décision

Option **B**. Un CDN/reverse-proxy est placé en frontal pour cacher les pages publiques (recherche de coiffeur,
fiches salon). Les disponibilités de créneaux, lecture fréquente et écriture rare, sont mises en cache
applicatif (Redis). Les tâches non critiques pour la transaction de réservation — envoi d'email/SMS de
confirmation — sont déplacées vers une file asynchrone plutôt que traitées en synchrone dans la requête de
réservation.

## Conséquences

**Positives**
- Résilience aux pics prévisibles sans surcoût d'infrastructure permanent.
- Le chemin critique (réservation) reste optimisé en priorité ; les notifications ne le ralentissent plus.
- Le CDN apporte un bénéfice de sécurité secondaire (absorption de trafic anormal).

**Négatives (compromis assumé)**
- Les notifications perdent leur instantanéité stricte (délai de quelques secondes) — jugé acceptable, un
  rappel de rendez-vous n'a pas besoin d'être synchrone.
- Nécessite une stratégie explicite d'invalidation de cache pour les disponibilités de créneaux, sous peine
  d'afficher un créneau déjà pris.

## Révision

Si les tests de charge (phase 3 du plan de réalisation) montrent que le cache seul ne suffit pas à tenir
< 2s à 500 utilisateurs simultanés, introduire une file d'attente virtuelle (« salle d'attente ») en amont du
flux de réservation plutôt que de sur-dimensionner l'infrastructure en continu.
