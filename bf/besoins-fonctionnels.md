# Besoins fonctionnels

Traduction des 9 besoins fonctionnels du brief (`architecture-logicielle-projet_1.md`) en exigences
détaillées et testables, enrichies des décisions prises dans [../adr/](../adr/README.md) et du
[plan d'architecture](../plan-architecture.md). Chaque BF porte ses critères d'acceptation et trace vers son
besoin d'origine, les contraintes concernées et l'ADR qui en cadre l'implémentation.

**Note transverse** : l'accessibilité clavier (C3) et la bascule RTL (C5) s'appliquent à tous les écrans, pas
seulement aux BF qui les citent explicitement — elles ne sont pas listées à chaque fois pour ne pas alourdir
le document.

**Priorité** : Essentiel (cœur du parcours de réservation) / Important (requis par le brief, peut suivre le
cœur transactionnel) / Souhaitable (valeur ajoutée, hors du parcours minimal).

---

<a id="bf-01"></a>
## BF-01 — Création de compte (client / professionnel)

| | |
|---|---|
| Origine | F1 |
| Acteurs | Client, Coiffeur |
| Contraintes | C3, C5 |
| ADR | [ADR-003](../adr/0003-mfa-accessible.md), [ADR-005](../adr/0005-i18n-rtl.md) |
| Priorité | Essentiel |

Permet à un client ou à un professionnel de créer un compte, avec enrôlement d'un second facteur
d'authentification dès l'inscription.

**Critères d'acceptation**
- Le formulaire est utilisable entièrement au clavier (Tab / Entrée), sans dépendance à la souris.
- L'enrôlement MFA propose TOTP (clé secrète affichée en repli du QR code, jamais celui-ci en unique
  option) ; WebAuthn/passkey reste la cible documentée par ADR-003 pour une itération ultérieure, non
  construite dans ce prototype.
- Le formulaire est disponible en français, anglais, arabe, avec bascule RTL automatique (ADR-005).
- Un compte professionnel comporte les champs « prestations proposées » et « langues parlées », nécessaires
  à BF-03.

<a id="bf-02"></a>
## BF-02 — Authentification (connexion)

| | |
|---|---|
| Origine | F1 (implicite) |
| Acteurs | Client, Coiffeur |
| Contraintes | C3 |
| ADR | [ADR-003](../adr/0003-mfa-accessible.md) |
| Priorité | Essentiel |

Connexion en deux facteurs à chaque session, hors appareils explicitement mémorisés par l'utilisateur.

**Critères d'acceptation**
- TOTP saisi manuellement, mécanisme MFA effectivement livré (WebAuthn en priorité et SMS en dernier
  recours restent des cibles documentées par ADR-003, non implémentées dans ce prototype).
- Focus visible à chaque étape ; erreurs annoncées via une zone ARIA live, pas uniquement par la couleur.
- Un échec sur le second facteur ne fait pas perdre la saisie déjà validée du premier.

<a id="bf-03"></a>
## BF-03 — Recherche de coiffeur

| | |
|---|---|
| Origine | F2 |
| Acteurs | Client |
| Contraintes | C2, C4 |
| ADR | [ADR-002](../adr/0002-cache-cdn-async.md), [ADR-007](../adr/0007-socle-technique-restreint.md) |
| Priorité | Essentiel |

Recherche par prestation (coupe, coloration, brushing…), localisation et langue parlée.

**Critères d'acceptation**
- Résultats retournés en < 2s à charge nominale (C2), y compris pendant un pic (500 utilisateurs simultanés).
- Résultats de recherche fréquents mis en cache (Redis) pour absorber les pics (ADR-002).
- Recherche réalisée via des filtres applicatifs PostgreSQL (prestation/ville/langue), sans moteur de
  recherche dédié (ADR-007) ; un index plein texte (`tsvector`/GIN) reste une piste d'amélioration si le
  volume de salons croît significativement.
- La dernière recherche effectuée reste consultable en lecture si le réseau se dégrade ensuite (C4).

<a id="bf-04"></a>
## BF-04 — Prise de rendez-vous

| | |
|---|---|
| Origine | F3 |
| Acteurs | Client |
| Contraintes | C2, C4 |
| ADR | [ADR-002](../adr/0002-cache-cdn-async.md), [ADR-004](../adr/0004-pwa-offline-first.md) |
| Priorité | Essentiel |

Réservation d'un créneau auprès d'un coiffeur, en ligne ou en file d'attente si hors-ligne.

**Critères d'acceptation**
- Réservation confirmée en < 2s en conditions nominales.
- Sans réseau, la demande est mise en file locale et affichée avec le statut explicite « en attente de
  synchronisation » — jamais présentée comme confirmée avant accusé serveur (ADR-004).
- En cas de conflit détecté à la synchronisation (créneau déjà pris entre-temps), le client se voit proposer
  un autre créneau plutôt qu'un message d'erreur sec (ADR-004).
- La notification de confirmation est envoyée de façon asynchrone, sans bloquer la réponse de réservation
  elle-même (ADR-002).

<a id="bf-05"></a>
## BF-05 — Annulation de rendez-vous

| | |
|---|---|
| Origine | F5 |
| Acteurs | Client |
| Contraintes | C4 |
| ADR | [ADR-004](../adr/0004-pwa-offline-first.md) |
| Priorité | Important |

**Critères d'acceptation**
- Annulable jusqu'à un délai configurable avant le rendez-vous.
- Fonctionne hors-ligne selon le même mécanisme de file que BF-04.
- Le créneau libéré redevient visible en recherche (BF-03) dès la synchronisation.

<a id="bf-06"></a>
## BF-06 — Report de rendez-vous

| | |
|---|---|
| Origine | F5 |
| Acteurs | Client |
| Contraintes | C4 |
| ADR | [ADR-004](../adr/0004-pwa-offline-first.md) |
| Priorité | Important |

**Critères d'acceptation**
- Le report est traité côté serveur comme une opération atomique (annulation + nouvelle réservation), pour
  qu'aucun état intermédiaire « sans rendez-vous » ne soit visible côté client.
- Mêmes garanties hors-ligne que BF-04 / BF-05.

<a id="bf-07"></a>
## BF-07 — Notification de rappel

| | |
|---|---|
| Origine | F4 |
| Acteurs | Client |
| Contraintes | C2, C7 |
| ADR | [ADR-002](../adr/0002-cache-cdn-async.md), [ADR-007](../adr/0007-socle-technique-restreint.md) |
| Priorité | Important |

**Critères d'acceptation**
- Rappel envoyé par email et/ou SMS un délai configurable avant le rendez-vous.
- Envoi via la file asynchrone (ADR-002), fournisseur tiers abstrait derrière une interface interne
  remplaçable (ADR-007).
- Un échec d'envoi n'affecte jamais une réservation déjà confirmée.

<a id="bf-08"></a>
## BF-08 — Espace client

| | |
|---|---|
| Origine | F6 |
| Acteurs | Client |
| Contraintes | C4 |
| ADR | [ADR-004](../adr/0004-pwa-offline-first.md) |
| Priorité | Essentiel |

**Critères d'acceptation**
- Liste des rendez-vous passés et à venir consultable, y compris hors-ligne (cache local en lecture).
- Les rendez-vous « en attente de synchronisation » sont visuellement distingués des rendez-vous confirmés.

<a id="bf-09"></a>
## BF-09 — Gestion des créneaux (professionnel)

| | |
|---|---|
| Origine | F7 |
| Acteurs | Coiffeur |
| Contraintes | C2 |
| ADR | [ADR-001](../adr/0001-monolithe-modulaire.md), [ADR-002](../adr/0002-cache-cdn-async.md) |
| Priorité | Essentiel |

**Critères d'acceptation**
- Le coiffeur définit et modifie ses créneaux disponibles.
- Toute modification invalide immédiatement le cache de disponibilités concerné (ADR-002), pour ne jamais
  exposer en recherche (BF-03) un créneau qui vient d'être retiré.

<a id="bf-10"></a>
## BF-10 — Validation ou refus de rendez-vous (professionnel)

| | |
|---|---|
| Origine | F7 |
| Acteurs | Coiffeur |
| Contraintes | C4 |
| ADR | [ADR-004](../adr/0004-pwa-offline-first.md) |
| Priorité | Essentiel |

**Critères d'acceptation**
- Le coiffeur valide ou refuse une demande de rendez-vous entrante.
- En cas de refus, le client est notifié (BF-07) et invité à reprendre une recherche (BF-03).

<a id="bf-11"></a>
## BF-11 — Support multilingue et sens de lecture

| | |
|---|---|
| Origine | F8 |
| Acteurs | Client, Coiffeur |
| Contraintes | C5, C7 |
| ADR | [ADR-005](../adr/0005-i18n-rtl.md) |
| Priorité | Important |

**Critères d'acceptation**
- Français, anglais et arabe disponibles sur l'ensemble des écrans, pas seulement les pages publiques.
- Bascule RTL automatique en arabe via l'attribut `dir`, sans gabarit dédié (ADR-005).
- Une clé de traduction manquante affiche un repli explicite plutôt que de bloquer le déploiement.

<a id="bf-12"></a>
## BF-12 — Assistance accessible (chatbot)

| | |
|---|---|
| Origine | F9 |
| Acteurs | Client |
| Contraintes | C3 |
| ADR | [ADR-003](../adr/0003-mfa-accessible.md) (principes d'accessibilité transverses) |
| Priorité | Souhaitable |

**Critères d'acceptation**
- Chatbot utilisable entièrement au clavier, compatible lecteur d'écran (rôles ARIA `log` / zone live
  appropriés).
- Toute réponse audio dispose systématiquement d'une alternative textuelle.
- Le focus clavier n'est jamais piégé dans le composant (« keyboard trap »).

<a id="bf-13"></a>
## BF-13 — Tableau de bord statistique agrégé

| | |
|---|---|
| Origine | dérivé de C6 (non listé explicitement comme besoin fonctionnel dans le brief, mais nécessaire pour satisfaire la contrainte) |
| Acteurs | Gestion salon |
| Contraintes | C6 |
| ADR | [ADR-006](../adr/0006-anonymisation-analytics.md) |
| Priorité | Souhaitable |

**Critères d'acceptation**
- Statistiques disponibles par prestation, salon et plage horaire — jamais par client identifié.
- Aucun agrégat sous le seuil de k-anonymat (5 occurrences) n'est restitué à l'écran (ADR-006).
- Accès réservé à un rôle « gestion salon », distinct du rôle coiffeur (BF-09, BF-10).

---

## Matrice de traçabilité

| BF | Besoin d'origine | Contraintes | ADR | Priorité |
|----|-------------------|-------------|-----|----------|
| BF-01 Création de compte | F1 | C3, C5 | ADR-003, ADR-005 | Essentiel |
| BF-02 Authentification | F1 (implicite) | C3 | ADR-003 | Essentiel |
| BF-03 Recherche de coiffeur | F2 | C2, C4 | ADR-002, ADR-007 | Essentiel |
| BF-04 Prise de rendez-vous | F3 | C2, C4 | ADR-002, ADR-004 | Essentiel |
| BF-05 Annulation | F5 | C4 | ADR-004 | Important |
| BF-06 Report | F5 | C4 | ADR-004 | Important |
| BF-07 Notification de rappel | F4 | C2, C7 | ADR-002, ADR-007 | Important |
| BF-08 Espace client | F6 | C4 | ADR-004 | Essentiel |
| BF-09 Gestion des créneaux | F7 | C2 | ADR-001, ADR-002 | Essentiel |
| BF-10 Validation / refus RDV | F7 | C4 | ADR-004 | Essentiel |
| BF-11 Multilingue / RTL | F8 | C5, C7 | ADR-005 | Important |
| BF-12 Assistance accessible | F9 | C3 | ADR-003 | Souhaitable |
| BF-13 Tableau de bord stats | — (dérivé C6) | C6 | ADR-006 | Souhaitable |

Chaque besoin fonctionnel du brief (F1–F9) est couvert par au moins un BF. BF-02 et BF-13 n'ont pas de
correspondance directe dans la liste initiale : le premier formalise une action implicite à F1 (se
connecter, pas seulement créer un compte), le second est une conséquence directe de la contrainte C6 que le
brief n'énonçait pas comme fonctionnalité utilisateur.
