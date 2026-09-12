# ADR-004 : PWA offline-first plutôt que dépendance réseau stricte

**Statut** : Proposé
**Date** : 2026-07-15
**Contraintes concernées** : C4 (qualité dégradée), F3 (agenda synchronisé)
**Tension liée** : T4 — voir [plan-architecture.md](../plan-architecture.md#t4)

## Contexte

Le brief exige que la plateforme reste fonctionnelle en cas de coupure réseau ou de faible bande passante,
notamment en zone rurale — un scénario explicitement cité. Or un agenda « synchronisé » (besoin fonctionnel
F3) suppose en général une confirmation serveur immédiate pour éviter tout double-réservation.

## Options envisagées

| Option | Avantages | Inconvénients |
|---|---|---|
| **A. Connexion active exigée pour toute action** (SPA classique) | Cohérence des données garantie à tout instant | Rend l'application inutilisable en zone rurale ou en coupure — viole directement C4 |
| **B. PWA offline-first : cache local en lecture + file de synchronisation en écriture (Background Sync)** | Consultation des RDV toujours possible hors-ligne ; réservation/annulation mises en file et rejouées à la reconnexion ; aligné sur le public cible cité dans le brief | Complexité de gestion des conflits (créneau pris entre-temps) à porter côté UI et API ; nécessite un état « provisoire » explicite dans le modèle de données |
| **C. Cache local en lecture seule, écritures bloquées hors-ligne** | Plus simple à implémenter que B | Ne répond que partiellement à C4 : ne couvre pas le cas d'usage réservation en zone à faible couverture, pourtant celui cité dans le brief |

## Décision

Option **B**, malgré sa complexité, car c'est la seule qui couvre le scénario explicitement cité dans le brief
(zone rurale, coupure réseau) sans dégrader la fonctionnalité principale de la plateforme (réservation).
L'application est construite comme une PWA : coquille applicative et rendez-vous du client mis en cache local,
actions de réservation/annulation mises en file via Background Sync et rejouées à la reconnexion, avec la
confirmation serveur qui fait foi en cas de conflit de créneau.

## Conséquences

**Positives**
- Continuité de service perçue par l'utilisateur même en connectivité instable.
- Différenciateur fonctionnel par rapport à une plateforme de réservation classique.

**Négatives (compromis assumé)**
- Une réservation faite hors-ligne reste « provisoire » et peut échouer si le créneau est pris entre-temps —
  l'état « en attente de synchronisation » doit être conçu et testé comme un état de première classe dans
  l'IHM, pas comme une exception.
- Risque de confusion utilisateur si le message de statut n'est pas assez explicite (point à couvrir dans
  l'audit RGAA/UX, phase 4).

## Révision

Si le taux réel de réservations en conflit (créneau pris entre la mise en file et la synchronisation) s'avère
élevé en usage réel, envisager un verrou temporaire côté serveur (créneau réservé « en option » quelques
minutes) plutôt qu'une confirmation a posteriori uniquement.

## État d'implémentation (prototype livrable 5)

La file locale est implémentée en `localStorage` (`prototype/src/lib/offlineQueue.ts`), pas via l'API
Background Sync : cette dernière est mal supportée hors navigateurs Chromium et a été écartée (voir
`prototype/public/service-worker.js` et `prototype/README.md`). La resynchronisation se déclenche sur
l'événement navigateur `online` ou sur action manuelle (« Synchroniser maintenant »), tant que l'application
est ouverte. **Compromis assumé supplémentaire** : sans Background Sync, aucune resynchronisation
automatique ne se produit si l'utilisateur rouvre l'application après le retour du réseau sans transition
`offline → online` détectée pendant que l'app tourne — il doit relancer la synchronisation lui-même. Le
comportement fonctionnel visé (état « en attente », confirmation serveur qui fait foi, gestion de conflit)
reste conforme ; seule la robustesse du déclenchement en arrière-plan diffère de l'intention initiale.
