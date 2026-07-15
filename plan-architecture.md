# Plan d'architecture — Plateforme de prise de rendez-vous en salon de coiffure

> Note de cadrage produite à partir de `architecture-logicielle-projet_1.md`.
> Version consultable avec diagrammes : voir l'artefact publié dans la conversation.
> Décisions détaillées : [adr/](adr/README.md). Besoins fonctionnels détaillés : [bf/besoins-fonctionnels.md](bf/besoins-fonctionnels.md).
> Parcours utilisateur détaillé : [pu/parcours-utilisateur.md](pu/parcours-utilisateur.md).

## 1. Lecture des contraintes

| ID | Contrainte | Ce qu'elle exige |
|----|------------|-------------------|
| C1 | Déploiement | Mutualisé low-cost aujourd'hui, cloud (AWS/Azure) demain, sans refonte majeure. |
| C2 | Performance | 500 utilisateurs simultanés en pic, temps de réponse < 2s. |
| C3 | Sécurité + accessibilité | MFA, entièrement utilisable au clavier pour les malvoyants. |
| C4 | Qualité dégradée | Fonctionne en coupure réseau / faible bande passante (zone rurale). |
| C5 | Localisation | FR / EN / AR, avec adaptation du sens de lecture (RTL). |
| C6 | Analyse métier | Statistiques agrégées sans exposer d'informations personnelles. |
| C7 | Maintenance | Équipe de 3 personnes, minimum de dépendances techniques. |

C7 borne toutes les autres réponses : c'est le fil rouge de la section 2.

## 2. Tensions architecturales et heuristiques retenues

> Chaque tension ci-dessous est développée en ADR complet (options comparées, conséquences, conditions de
> révision) dans [adr/](adr/README.md).

<a id="t1"></a>
### T1 — Sobriété d'hébergement vs trajectoire cloud (C1, C7)
- **Tension** : microservices/Kubernetes = meilleure scalabilité indépendante, mais hors de portée d'un mutualisé bon marché et d'une équipe de 3 personnes ; coder pour un mutualisé « classique » risque une refonte à la migration.
- **Heuristique retenue** : monolithe modulaire 12-factor (modules à bornes claires : Identité, Agenda, Recherche, Notifications, i18n, Analytics), sans état, config par variables d'environnement, empaqueté en une image de conteneur unique dès le développement.
- **Compromis assumé** : pas d'isolation ni de scaling indépendant par module — acceptable au volume visé (500 utilisateurs en pic).

<a id="t2"></a>
### T2 — Performance sous charge vs budget d'infrastructure (C2, C1)
- **Tension** : tenir < 2s à 500 utilisateurs simultanés sur un mutualisé peu coûteux, sans sur-dimensionner.
- **Heuristique retenue** : CDN/reverse-proxy en frontal, cache applicatif (Redis) sur les disponibilités de créneaux, traitement asynchrone des tâches non critiques (SMS/email en file).
- **Compromis assumé** : notifications non strictement synchrones (délai de quelques secondes) — sans impact métier.

<a id="t3"></a>
### T3 — Authentification forte vs accessibilité clavier (C3)
- **Tension** : la plupart des MFA du marché (QR code, CAPTCHA visuel) sont inutilisables au clavier seul par une personne malvoyante.
- **Heuristique retenue** : WebAuthn/passkeys en méthode principale, TOTP saisi manuellement en repli, SMS en dernier recours ; aucun mécanisme reposant uniquement sur souris/vision. Parcours validé Tab/Entrée, focus visible, erreurs en zone ARIA live.
- **Compromis assumé** : développement du flux d'authentification plus long qu'une solution MFA « clé en main » non accessible.

<a id="t4"></a>
### T4 — Continuité réseau dégradé vs cohérence de l'agenda (C4, F3)
- **Tension** : un agenda synchronisé suppose en général une confirmation serveur immédiate, impossible à garantir en zone rurale/faible bande passante.
- **Heuristique retenue** : PWA offline-first — coquille et RDV du client en cache local, actions de réservation mises en file (Background Sync) et rejouées à la reconnexion, confirmation serveur qui fait foi en cas de conflit.
- **Compromis assumé** : une réservation hors-ligne reste « provisoire » et peut échouer — l'IHM doit l'afficher explicitement.

<a id="t5"></a>
### T5 — Richesse linguistique (FR/EN/AR) vs équipe réduite (C5, C7)
- **Tension** : trois langues dont une RTL peuvent imposer trois gabarits à maintenir en parallèle.
- **Heuristique retenue** : propriétés CSS logiques dès la première maquette, moteur i18n à base de clés (ICU), traductions traitées comme données externalisées. RTL = bascule d'attribut `dir="rtl"`, pas une réécriture.
- **Compromis assumé** : discipline CSS stricte à imposer dès le départ (interdiction de left/right physiques).

<a id="t6"></a>
### T6 — Valeur analytique vs protection des données (C6)
- **Tension** : le métier veut des statistiques, le brief interdit d'exposer des données personnelles dans les agrégats.
- **Heuristique retenue** : flux d'événements anonymisés (prestation, salon, créneau arrondi — jamais nom/email/téléphone) vers un espace de reporting séparé, seuil de k-anonymat (agrégats < 5 occurrences non restitués).
- **Compromis assumé** : pas d'analyse fine par client individuel, en échange d'une conformité RGPD by design opérable sans DPO dédié.

<a id="t7"></a>
### T7 (méta-tension) — Ambition fonctionnelle vs capacité d'équipe (C7, transverse)
- **Tension** : chaque contrainte tire vers un composant technique supplémentaire ; cumulés, ils dépassent ce que 3 personnes peuvent exploiter durablement.
- **Heuristique retenue** : toute nouvelle capacité s'appuie sur une brique déjà choisie (un seul SGBD, un seul cache, une seule file, un seul hébergeur) ; chaque écart documenté en ADR.
- **Compromis assumé** : renoncer à la solution « idéale » pièce par pièce (ex. Elasticsearch) au profit d'une solution suffisante (index PostgreSQL).

## 3. Vue d'architecture

```mermaid
flowchart TB
  client["Client grand public<br/>(web / mobile, parfois hors-ligne)"]
  pro["Coiffeur<br/>(gestion agenda)"]
  plateforme["Plateforme de prise<br/>de rendez-vous"]
  notif["Fournisseur SMS / Email"]
  cloud["Cloud AWS / Azure<br/>(cible de migration)"]

  client -->|"recherche, réserve, annule"| plateforme
  pro -->|"gère créneaux, valide RDV"| plateforme
  plateforme -->|"envoie rappels"| notif
  plateforme -.->|"migration sans refonte majeure"| cloud
```

```mermaid
flowchart TB
  pwa["PWA cliente<br/>(offline-first)"]
  cdn["CDN / reverse proxy"]
  subgraph app["Application — un seul déployable"]
    auth["Identité & Auth<br/>(MFA accessible)"]
    agenda["Agenda & Réservation"]
    recherche["Recherche & Découverte"]
    notifmod["Notifications<br/>(file asynchrone)"]
    i18n["i18n & Contenu<br/>(FR / EN / AR)"]
    analytics["Analytics<br/>(vues anonymisées)"]
  end
  db[("PostgreSQL")]
  cache[("Redis<br/>cache + sessions")]

  pwa -->|"HTTPS"| cdn --> app
  auth --> db
  agenda --> db
  agenda --> cache
  recherche --> cache
  notifmod --> db
  analytics --> db
```

```mermaid
flowchart LR
  subgraph phase1["Phase 1 — mutualisé low-cost"]
    p1app["Conteneur applicatif unique"]
    p1db[("PostgreSQL managé,<br/>entrée de gamme")]
    p1cache[("Redis, instance unique")]
  end
  subgraph phase2["Phase 2 — cloud AWS / Azure"]
    p2app["Service applicatif<br/>scalable horizontalement"]
    p2db[("Base managée<br/>RDS / Azure DB")]
    p2cache[("Cache managé")]
    p2queue["File managée<br/>SQS / Service Bus"]
  end
  p1app -. "même image conteneur" .-> p2app
  p1db -. "réplication / dump" .-> p2db
  p1cache -. "même client Redis" .-> p2cache
```

```mermaid
sequenceDiagram
  participant U as Client (hors-ligne)
  participant SW as Service Worker
  participant API as API Agenda
  U->>SW: Demande de réservation
  SW->>SW: File d'attente locale (Background Sync)
  Note over U: Statut affiché : "en attente de synchronisation"
  SW->>API: Rejoue la demande (retour réseau)
  alt Créneau encore disponible
    API-->>SW: Confirmation
    SW-->>U: RDV confirmé
  else Créneau déjà pris
    API-->>SW: Conflit
    SW-->>U: Proposer un autre créneau
  end
```

Diagramme de cas d'utilisation et diagramme de composants détaillé : à produire en phase 2 du plan, une fois les modules validés en équipe.

## 4. Socle technique proposé

| Rôle | Choix | Justification |
|------|-------|----------------|
| Client | Framework SSR + PWA | Performance perçue et accessibilité (T2, T3), service worker pour le mode dégradé (T4), i18n intégré (C5). |
| Application | Monolithe modulaire, un seul langage front/back | Limite le nombre de compétences à couvrir par 3 personnes (T7). |
| Données | PostgreSQL | Intégrité pour éviter le double-réservation (T4), recherche plein texte intégrée — évite un moteur dédié (T7). |
| Cache / sessions | Redis | Disponibilités de créneaux et sessions MFA en lecture rapide (T2). |
| Tâches asynchrones | File intégrée au framework | Découple les notifications du chemin critique (T2), migrable vers un service managé en phase 2. |
| Frontal réseau | CDN / reverse proxy | Cache des pages publiques, absorption des pics (T2), compatible mutualisé. |
| SMS / email | Fournisseur tiers derrière une interface | Le module Notifications ne connaît qu'un contrat interne (T7). |
| Authentification | WebAuthn + TOTP | Seules méthodes MFA testées accessibles au clavier/lecteur d'écran (T3). |

## 5. Plan de réalisation des livrables

1. **Semaine 1 — Cadrage** : besoins non-fonctionnels, personas (client, coiffeur, utilisateur malvoyant au clavier), parcours nominal et dégradé.
2. **Semaine 2 — Décisions d'architecture** : ADR complets pour T1–T7, diagrammes C4 (contexte/conteneurs), diagramme de cas d'utilisation, diagramme de déploiement à deux phases.
3. **Semaine 3 — Performance** : scénario critique (ouverture de créneaux, 500 utilisateurs), plan de test de charge (k6/Locust), optimisations, rapport avec hypothèses de dimensionnement.
4. **Semaines 3–4 — Accessibilité** : audit RGAA 4 partiel sur 2 écrans clés (recherche, formulaire de RDV avec MFA), non-conformités et corrections consignées.
5. **Semaine 4 — Prototype (optionnel)** : wireframe interactif démontrant le parcours clavier complet, y compris l'authentification.
6. **Semaine 5 — Soutenance** : présentation construite autour de T1–T7 comme fil narratif.

## 6. Risques résiduels

- **RTL tardif** — tester `dir="rtl"` dès la phase 2, pas en phase 4, pour éviter des régressions visuelles coûteuses en fin de projet.
- **Portabilité cloud** — valider dès la phase 2 que l'image conteneur tourne à l'identique en local et sur l'hébergeur cible, avant d'écrire la moindre fonctionnalité métier.
- **MFA non accessible** — test manuel lecteur d'écran (NVDA/VoiceOver) sur le parcours d'authentification avant la fin de la phase 2.
- **Charge non mesurée** — prévoir une file d'attente virtuelle (« salle d'attente ») si le pic dépasse la capacité mesurée, plutôt qu'un sur-provisionnement permanent.

---

Ce document propose un cadrage argumenté, pas une décision figée : chaque heuristique (T1–T7) reste révisable dès qu'un compromis cesse d'être acceptable — c'est précisément ce qu'un ADR est fait pour documenter.
