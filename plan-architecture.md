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

> **Vocabulaire des attributs de qualité** (caractéristiques architecturales) utilisé pour nommer les oppositions T1–T7 :
> Agilité, Fiabilité, Scalabilité, Faisabilité, Déployabilité, Utilisabilité, Élasticité, Testabilité, Performance,
> Sécurité, Disponibilité, Maintenabilité. Chaque caractéristique que le système doit prendre en charge ajoute de la
> complexité à sa conception — c'est cette friction, propre à chaque tension, qui motive l'heuristique retenue.

<a id="t1"></a>
### T1 — Sobriété d'hébergement vs trajectoire cloud (C1, C7)
- **Tension** : microservices/Kubernetes = meilleure scalabilité indépendante, mais hors de portée d'un mutualisé bon marché et d'une équipe de 3 personnes ; coder pour un mutualisé « classique » risque une refonte à la migration.
- **Attributs de qualité en tension** : **Scalabilité** / **Élasticité** (montée en charge indépendante par service) *vs* **Déployabilité** / **Maintenabilité** / **Faisabilité** (un seul artefact à opérer, équipe de 3, hébergement mutualisé).
- **Heuristique retenue** : monolithe modulaire 12-factor (modules à bornes claires : Identité, Agenda, Recherche, Notifications, i18n, Analytics), sans état, config par variables d'environnement, empaqueté en une image de conteneur unique dès le développement.
- **Compromis assumé** : pas d'isolation ni de scaling indépendant par module — acceptable au volume visé (500 utilisateurs en pic).

<a id="t2"></a>
### T2 — Performance sous charge vs budget d'infrastructure (C2, C1)
- **Tension** : tenir < 2s à 500 utilisateurs simultanés sur un mutualisé peu coûteux, sans sur-dimensionner.
- **Attributs de qualité en tension** : **Performance** / **Disponibilité** (tenir la charge de pointe) *vs* **Faisabilité** (budget d'infrastructure mutualisé, pas de sur-provisionnement).
- **Heuristique retenue** : CDN/reverse-proxy en frontal, cache applicatif (Redis) sur les disponibilités de créneaux, traitement asynchrone des tâches non critiques (SMS/email en file).
- **Compromis assumé** : notifications non strictement synchrones (délai de quelques secondes) — sans impact métier.
- **Constat de test de charge** : les tests k6 ont révélé un dépassement réel du seuil de 2s (p95 jusqu'à ~3,4s), causé non par le cache mais par un plafond CPU (hachage `scrypt` synchrone). Corrigé par un hachage asynchrone puis une exécution en cluster Node (`prototype/server.js`), ramenant le p95 à ~1,3s. Détail complet dans [ADR-002](adr/0002-cache-cdn-async.md) (§ Constats) et `performance/rapport-performance.md`.

<a id="t3"></a>
### T3 — Authentification forte vs accessibilité clavier (C3)
- **Tension** : la plupart des MFA du marché (QR code, CAPTCHA visuel) sont inutilisables au clavier seul par une personne malvoyante.
- **Attributs de qualité en tension** : **Sécurité** (authentification forte, MFA) *vs* **Utilisabilité** (parcours 100% clavier/lecteur d'écran).
- **Heuristique retenue** : WebAuthn/passkeys en méthode principale, TOTP saisi manuellement en repli, SMS en dernier recours ; aucun mécanisme reposant uniquement sur souris/vision. Parcours validé Tab/Entrée, focus visible, erreurs en zone ARIA live.
- **Compromis assumé** : développement du flux d'authentification plus long qu'une solution MFA « clé en main » non accessible.
- **État d'implémentation (prototype)** : TOTP est le mécanisme MFA fonctionnel et testé. WebAuthn/passkey et le repli SMS restent des cibles documentées par cette ADR, non construites dans ce prototype (voir `prototype/README.md`) — TOTP seul satisfait déjà l'exigence C3 (MFA accessible au clavier), mais sans le gain de résistance au phishing propre à WebAuthn.

<a id="t4"></a>
### T4 — Continuité réseau dégradé vs cohérence de l'agenda (C4, F3)
- **Tension** : un agenda synchronisé suppose en général une confirmation serveur immédiate, impossible à garantir en zone rurale/faible bande passante.
- **Attributs de qualité en tension** : **Disponibilité** (fonctionner en coupure réseau / faible bande passante) *vs* **Fiabilité** (cohérence de l'agenda, pas de double-réservation).
- **Heuristique retenue** : PWA offline-first — coquille et RDV du client en cache local, actions de réservation mises en file (Background Sync) et rejouées à la reconnexion, confirmation serveur qui fait foi en cas de conflit.
- **Compromis assumé** : une réservation hors-ligne reste « provisoire » et peut échouer — l'IHM doit l'afficher explicitement.
- **État d'implémentation (prototype)** : la file locale est gérée en `localStorage` (pas via l'API Background Sync, non retenue en raison d'un support navigateur inégal hors Chromium) et rejouée sur l'événement `online` ou sur action manuelle (« Synchroniser maintenant ») pendant que l'application est ouverte — voir `prototype/README.md`. Limite assumée : sans Background Sync, une resynchronisation ne se déclenche pas automatiquement si l'utilisateur rouvre l'application après le retour du réseau ; il doit relancer la synchronisation manuellement.

<a id="t5"></a>
### T5 — Richesse linguistique (FR/EN/AR) vs équipe réduite (C5, C7)
- **Tension** : trois langues dont une RTL peuvent imposer trois gabarits à maintenir en parallèle.
- **Attributs de qualité en tension** : **Utilisabilité** (FR/EN/AR, adaptation RTL) *vs* **Maintenabilité** / **Faisabilité** (trois gabarits à maintenir avec une équipe de 3 personnes).
- **Heuristique retenue** : propriétés CSS logiques dès la première maquette, moteur i18n à base de clés (ICU), traductions traitées comme données externalisées. RTL = bascule d'attribut `dir="rtl"`, pas une réécriture.
- **Compromis assumé** : discipline CSS stricte à imposer dès le départ (interdiction de left/right physiques).

<a id="t6"></a>
### T6 — Valeur analytique vs protection des données (C6)
- **Tension** : le métier veut des statistiques, le brief interdit d'exposer des données personnelles dans les agrégats.
- **Attributs de qualité en tension** : **Utilisabilité** (valeur exploitable des statistiques pour le métier) *vs* **Sécurité** (anonymisation, protection des données personnelles, conformité RGPD).
- **Heuristique retenue** : flux d'événements anonymisés (prestation, salon, créneau arrondi — jamais nom/email/téléphone) vers un espace de reporting séparé, seuil de k-anonymat (agrégats < 5 occurrences non restitués).
- **Compromis assumé** : pas d'analyse fine par client individuel, en échange d'une conformité RGPD by design opérable sans DPO dédié.

<a id="t7"></a>
### T7 (méta-tension) — Ambition fonctionnelle vs capacité d'équipe (C7, transverse)
- **Tension** : chaque contrainte tire vers un composant technique supplémentaire ; cumulés, ils dépassent ce que 3 personnes peuvent exploiter durablement.
- **Attributs de qualité en tension** : **Agilité** (capacité à ajouter de nouvelles caractéristiques — Scalabilité, Élasticité, Performance, Sécurité, Disponibilité, Testabilité…) *vs* **Maintenabilité** / **Faisabilité** (ce qu'une équipe de 3 personnes peut opérer durablement). C'est la tension chapeau : chaque caractéristique ajoutée par T1–T6 alimente ce même arbitrage transverse.
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
  SW->>SW: File d'attente locale (localStorage)
  Note over U: Statut affiché : "en attente de synchronisation"
  SW->>API: Rejoue la demande (retour réseau ou action manuelle)
  alt Créneau encore disponible
    API-->>SW: Confirmation
    SW-->>U: RDV confirmé
  else Créneau déjà pris
    API-->>SW: Conflit
    SW-->>U: Proposer un autre créneau
  end
```

**État d'implémentation (prototype)** : la resynchronisation est déclenchée par l'événement navigateur
`online` ou par une action manuelle (« Synchroniser maintenant »), tant que l'application est ouverte —
pas par l'API Background Sync (support navigateur inégal hors Chromium, non retenue). Conséquence assumée :
si l'utilisateur rouvre l'application après le retour du réseau sans avoir eu l'app ouverte pendant la
transition, la synchronisation doit être relancée manuellement.

### Diagramme de cas d'utilisation

```mermaid
flowchart LR
  client["Client"]
  pro["Coiffeur"]
  gestion["Gestion salon"]

  subgraph systeme["Plateforme de prise de rendez-vous"]
    uc1(["Créer un compte"])
    uc2(["S'authentifier (MFA)"])
    uc3(["Rechercher un coiffeur"])
    uc4(["Prendre RDV"])
    uc5(["Annuler RDV"])
    uc6(["Reporter RDV"])
    uc7(["Consulter espace client"])
    uc8(["Gérer ses créneaux"])
    uc9(["Valider / refuser RDV"])
    uc10(["Recevoir un rappel"])
    uc11(["Consulter les stats agrégées"])
  end

  client --> uc1
  client --> uc2
  client --> uc3
  client --> uc4
  client --> uc5
  client --> uc6
  client --> uc7
  client --> uc10
  pro --> uc1
  pro --> uc2
  pro --> uc8
  pro --> uc9
  gestion --> uc11

  uc4 -. "include" .-> uc2
  uc5 -. "include" .-> uc2
  uc6 -. "include" .-> uc2
  uc9 -. "include" .-> uc10
```

Les cas d'utilisation renvoient chacun à un besoin fonctionnel détaillé dans
[bf/besoins-fonctionnels.md](bf/besoins-fonctionnels.md) (BF-01 à BF-13) ; les inclusions (`include`)
matérialisent les garde-fous transverses (T3 : pas de réservation/annulation/report sans authentification
MFA déjà posée ; validation d'un RDV déclenche systématiquement une notification, T2/T7).

### Diagrammes C4

**Niveau 1 — Contexte**

```mermaid
C4Context
  title Contexte — Plateforme de prise de rendez-vous
  Person(client, "Client", "Recherche, réserve, gère ses rendez-vous")
  Person(pro, "Coiffeur", "Gère créneaux, valide/refuse un RDV")
  System(plateforme, "Plateforme de prise de rendez-vous", "Monolithe modulaire")
  System_Ext(notif, "Fournisseur SMS / Email", "Envoi des rappels")
  System_Ext(cloud, "Cloud AWS / Azure", "Cible de migration, phase 2 (C1)")

  Rel(client, plateforme, "Recherche, réserve, annule", "HTTPS")
  Rel(pro, plateforme, "Gère créneaux, valide RDV", "HTTPS")
  Rel(plateforme, notif, "Envoie les rappels", "API")
  Rel(plateforme, cloud, "Migration sans refonte majeure", "à terme")
```

**Niveau 2 — Conteneurs**

```mermaid
C4Container
  title Conteneurs — Plateforme de prise de rendez-vous
  Person(client, "Client", "web/mobile, parfois hors-ligne")
  Person(pro, "Coiffeur", "back-office salon")

  System_Boundary(sys, "Plateforme de prise de rendez-vous") {
    Container(pwa, "PWA cliente", "Next.js, Service Worker", "IHM accessible, offline-first (ADR-004)")
    Container(cdn, "CDN / reverse proxy", "Edge / Nginx", "Cache pages publiques, absorbe les pics (ADR-002)")
    Container(app, "Application", "Next.js, monolithe modulaire", "Identité, Agenda, Recherche, Notifications, i18n, Analytics (ADR-001)")
    ContainerDb(db, "Base de données", "PostgreSQL", "Données transactionnelles + recherche par filtres (ADR-007)")
    ContainerDb(cache, "Cache", "Redis", "Disponibilités de créneaux (ADR-002)")
    Container(queue, "File asynchrone", "intégrée au framework", "Notifications découplées (ADR-002)")
  }
  System_Ext(notif, "Fournisseur SMS / Email", "Mailhog en démo, fournisseur réel en prod")

  Rel(client, pwa, "Utilise", "HTTPS")
  Rel(pro, pwa, "Utilise", "HTTPS")
  Rel(pwa, cdn, "Requêtes", "HTTPS")
  Rel(cdn, app, "Route", "HTTP")
  Rel(app, db, "Lit / écrit", "SQL")
  Rel(app, cache, "Lit / écrit", "Redis protocol")
  Rel(app, queue, "Empile", "in-process")
  Rel(queue, notif, "Envoie", "API")
```

**Niveau 3 — Composants (zoom sur le conteneur « Application »)**

```mermaid
C4Component
  title Composants — Application (monolithe modulaire)
  Container_Boundary(app, "Application — un seul déployable") {
    Component(auth, "Identité & Auth", "module", "Inscription, connexion, MFA TOTP — WebAuthn documenté comme cible (ADR-003)")
    Component(agenda, "Agenda & Réservation", "module", "Créneaux, RDV, résolution de conflits (ADR-004)")
    Component(recherche, "Recherche & Découverte", "module", "Filtre prestation / localisation / langue (BF-03)")
    Component(notifmod, "Notifications", "module", "Producteur de la file asynchrone (ADR-002)")
    Component(i18nmod, "i18n & Contenu", "module", "FR / EN / AR, bascule RTL (ADR-005)")
    Component(analytics, "Analytics", "module", "Agrégats anonymisés, seuil de k-anonymat (ADR-006)")
  }
  ContainerDb(db, "PostgreSQL", "base de données")
  ContainerDb(cache, "Redis", "cache")

  Rel(auth, db, "Lit / écrit comptes (sessions en cookie chiffré, hors DB)")
  Rel(agenda, db, "Lit / écrit créneaux, RDV")
  Rel(agenda, cache, "Lit / invalide les disponibilités")
  Rel(recherche, cache, "Lit les résultats mis en cache")
  Rel(recherche, db, "Filtres prestation/ville/langue")
  Rel(notifmod, db, "Lit le modèle de rappel")
  Rel(analytics, db, "Lit les événements anonymisés")
```

Les frontières de composants ci-dessus correspondent directement à l'arborescence `prototype/src/` du
prototype (livrable 5) : un module = un dossier, pas de couplage caché entre modules — c'est la condition
posée par [ADR-001](adr/0001-monolithe-modulaire.md) pour qu'une future extraction en service séparé reste
possible sans refonte majeure (T1).

## 4. Socle technique proposé

| Rôle | Choix | Justification |
|------|-------|----------------|
| Client | Framework SSR + PWA | Performance perçue et accessibilité (T2, T3), service worker pour le mode dégradé (T4), i18n intégré (C5). |
| Application | Monolithe modulaire, un seul langage front/back | Limite le nombre de compétences à couvrir par 3 personnes (T7). |
| Données | PostgreSQL | Intégrité pour éviter le double-réservation (T4), recherche par filtres applicatifs (prestation/ville/langue) — évite un moteur dédié (T7). Un index plein texte PostgreSQL (`tsvector`/GIN) reste une piste d'amélioration si le nombre de salons croît significativement. |
| Cache | Redis | Disponibilités de créneaux en lecture rapide (T2). Les sessions utilisateur sont gérées via cookie chiffré (`iron-session`), sans dépendance à Redis. |
| Tâches asynchrones | File intégrée au framework | Découple les notifications du chemin critique (T2), migrable vers un service managé en phase 2. Dans le prototype, ce traitement est non-bloquant (fire-and-forget) plutôt qu'une file avec ordonnancement/retry persistant. |
| Frontal réseau | CDN / reverse proxy | Cache des pages publiques, absorption des pics (T2), compatible mutualisé. |
| SMS / email | Fournisseur tiers derrière une interface | Le module Notifications ne connaît qu'un contrat interne (T7). |
| Authentification | TOTP fonctionnel ; WebAuthn documenté comme cible | Seule méthode MFA testée et livrée, accessible au clavier/lecteur d'écran (T3) ; WebAuthn (résistance au phishing) et le repli SMS restent à construire. |

## 5. Plan de réalisation des livrables

1. **Semaine 1 — Cadrage** : besoins non-fonctionnels, personas (client, coiffeur, utilisateur malvoyant au clavier), parcours nominal et dégradé.
2. **Semaine 2 — Décisions d'architecture** : ADR complets pour T1–T7, diagrammes C4 (contexte/conteneurs), diagramme de cas d'utilisation, diagramme de déploiement à deux phases.
3. **Semaine 3 — Performance** : scénario critique (ouverture de créneaux, 500 utilisateurs), plan de test de charge (k6/Locust), optimisations, rapport avec hypothèses de dimensionnement.
4. **Semaines 3–4 — Accessibilité** : audit RGAA 4 partiel sur 2 écrans clés (recherche, formulaire de RDV avec MFA), non-conformités et corrections consignées.
5. **Semaine 4 — Prototype** : maquette fonctionnelle packagée en `docker-compose`, démontrant le parcours clavier complet (recherche, authentification MFA, réservation, espace client), le mode dégradé et la bascule RTL.
6. **Semaine 5 — Soutenance** : présentation construite autour de T1–T7 comme fil narratif.

## 6. Risques résiduels

- **RTL tardif** — tester `dir="rtl"` dès la phase 2, pas en phase 4, pour éviter des régressions visuelles coûteuses en fin de projet.
- **Portabilité cloud** — valider dès la phase 2 que l'image conteneur tourne à l'identique en local et sur l'hébergeur cible, avant d'écrire la moindre fonctionnalité métier.
- **MFA non accessible** — test manuel lecteur d'écran (NVDA/VoiceOver) sur le parcours d'authentification avant la fin de la phase 2.
- **Charge non mesurée** — prévoir une file d'attente virtuelle (« salle d'attente ») si le pic dépasse la capacité mesurée, plutôt qu'un sur-provisionnement permanent.

---

Ce document propose un cadrage argumenté, pas une décision figée : chaque heuristique (T1–T7) reste révisable dès qu'un compromis cesse d'être acceptable — c'est précisément ce qu'un ADR est fait pour documenter.
