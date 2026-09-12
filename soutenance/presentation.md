---
marp: true
title: Salon RDV — soutenance
paginate: true
---

<!--
Trame de soutenance, format Marp (export possible en PDF/PPTX : `npx @marp-team/marp-cli presentation.md
--pdf`). Diagrammes complets (C4, cas d'utilisation, déploiement, séquence) volontairement laissés en
dehors des slides : voir dossier/dossier-architecture-logicielle.md — les slides restent des supports de
narration, pas le dossier lui-même.
-->

# Plateforme de prise de rendez-vous en salon de coiffure

Dossier d'architecture logicielle — soutenance

Fil narratif : sept tensions (T1–T7), sept compromis assumés

---

## Le besoin métier

Une **chaîne régionale de salons de coiffure** veut :

- réduire les files d'attente,
- améliorer l'accès aux coiffeurs,
- **y compris pour les personnes en situation de handicap.**

Ce dernier point n'est pas une fonctionnalité parmi d'autres : il **façonne des choix d'architecture**
(authentification, structuration HTML) autant que les contraintes de performance ou de budget.

---

## Besoins fonctionnels — priorisés

| Priorité | Couverture |
|---|---|
| **Essentiel** | Compte, connexion MFA, recherche, réservation, espace client, gestion des créneaux, validation/refus |
| **Important** | Annulation, report, notifications, multilingue/RTL |
| **Souhaitable** | Assistance accessible, tableau de bord statistique |

13 besoins fonctionnels détaillés (BF-01 à BF-13), traçés vers le brief et vers les décisions
d'architecture — [bf/besoins-fonctionnels.md](../bf/besoins-fonctionnels.md).

---

## Sept contraintes, un fil rouge

| C1 | Déploiement mutualisé → cloud, sans refonte |
|---|---|
| C2 | 500 utilisateurs simultanés, < 2s |
| C3 | MFA **et** entièrement clavier |
| C4 | Fonctionne en réseau dégradé |
| C5 | FR / EN / AR, RTL |
| C6 | Statistiques sans données personnelles |
| **C7** | **Équipe de 3 personnes, dépendances minimales** |

**C7 borne toutes les autres réponses** — c'est la tension chapeau (T7).

---

## Méthode : heuristiques et compromis

Chaque contrainte ajoutée fait entrer deux attributs de qualité en tension.

Pour chacune (T1–T7) :
1. la tension identifiée,
2. l'heuristique retenue,
3. **le compromis explicitement assumé en échange** — jamais une solution « parfaite »,
   toujours une décision documentée et révisable.

→ formalisé en [ADR](../adr/README.md), un par tension.

---

## T1 — Sobriété d'hébergement vs trajectoire cloud

**Tension** : microservices = scalabilité indépendante, mais hors de portée d'un mutualisé bon marché et
d'une équipe de 3 personnes.

**Heuristique** : monolithe modulaire 12-factor, un seul déployable, modules à bornes claires.

**Compromis assumé** : pas d'isolation ni de scaling indépendant par module — acceptable au volume visé.

---

## T2 — Performance sous charge vs budget d'infrastructure

**Tension** : tenir < 2s à 500 utilisateurs simultanés, sans sur-dimensionner.

**Heuristique** : CDN, cache Redis sur les disponibilités, traitement asynchrone des notifications.

**Compromis assumé** : notifications non strictement synchrones (quelques secondes de délai).

**Vérifié en charge réelle** (k6, section performance) : le cache tient la charge — le vrai goulot trouvé
était ailleurs (voir plus loin).

---

## T3 — Authentification forte vs accessibilité clavier

**Tension** : la plupart des MFA du marché (QR code, CAPTCHA visuel) sont inutilisables au clavier seul.

**Heuristique** : WebAuthn/passkey en principal, TOTP en repli — jamais de mécanisme souris-seule.

**Compromis assumé** : flux d'authentification plus long à développer qu'une solution MFA « clé en main »
non accessible.

**Prototype** : TOTP est le **seul** mécanisme MFA construit et vérifié (parcours 100 % clavier, trace
automatisée). WebAuthn/passkey reste la cible documentée par l'ADR-003 pour une itération ultérieure — non
implémenté dans ce prototype, sans dépendance WebAuthn dans le code.

---

## T4 — Continuité réseau dégradé vs cohérence de l'agenda

**Tension** : un agenda synchronisé suppose une confirmation serveur immédiate — impossible à garantir en
zone rurale.

**Heuristique** : PWA offline-first, réservation mise en file et rejouée à la reconnexion, confirmation
serveur qui fait foi en cas de conflit.

**Compromis assumé** : une réservation hors-ligne reste « provisoire », affichée explicitement comme telle.

**Prototype** : file locale en `localStorage` (pas l'API Background Sync, écartée pour support navigateur
inégal hors Chromium), rejouée sur l'événement `online` ou action manuelle tant que l'app est ouverte —
limite assumée : pas de resynchro automatique si l'app est rouverte après coup.

**Vérifié en charge réelle (concurrence, pas réseau dégradé)** : 150 utilisateurs simultanés sur 40
créneaux → aucune double réservation, conflits résolus proprement. Ce test valide la cohérence de
l'agenda sous charge, pas le comportement hors-ligne à proprement parler.

---

## T5 — Richesse linguistique vs équipe réduite

**Tension** : trois langues dont une RTL peuvent imposer trois gabarits à maintenir en parallèle.

**Heuristique** : propriétés CSS logiques dès la première maquette, i18n par clés, RTL = bascule d'attribut
`dir`, pas une réécriture.

**Compromis assumé** : discipline CSS stricte à imposer dès le départ.

**Prototype** : un seul jeu de composants, trois langues, bascule RTL instantanée — démontré en direct.

---

## T6 — Valeur analytique vs protection des données

**Tension** : le métier veut des statistiques, le brief interdit d'exposer des données personnelles.

**Heuristique** : agrégats anonymisés, seuil de k-anonymat (< 5 occurrences non restitué).

**Compromis assumé** : pas d'analyse fine par client individuel.

**Prototype** : tableau de bord fonctionnel, vérifié — un regroupement à 2 occurrences est bien masqué,
un regroupement à 8 est affiché.

---

## T7 — Ambition fonctionnelle vs capacité d'équipe (méta-tension)

**Tension** : chaque contrainte tire vers un composant technique supplémentaire ; cumulés, ils dépassent ce
que 3 personnes peuvent exploiter durablement.

**Heuristique** : toute nouvelle capacité s'appuie sur une brique déjà choisie — un seul SGBD, un seul
cache, un seul hébergeur.

**Compromis assumé** : renoncer à la solution « idéale » pièce par pièce au profit d'une solution
suffisante.

C'est le test que chaque heuristique T1–T6 a dû passer.

---

## Socle technique retenu

| Rôle | Choix |
|---|---|
| Client | Next.js — SSR + PWA |
| Application | Monolithe modulaire, TypeScript unique front/back |
| Données | PostgreSQL (recherche par filtres applicatifs — pas d'index plein texte dédié) |
| Cache | Redis (disponibilités de créneaux ; sessions en cookie chiffré, hors Redis) |
| Authentification | TOTP fonctionnel, WebAuthn documenté comme cible |
| Notifications | Interface interne, fournisseur interchangeable |

Diagrammes C4 complets (contexte / conteneurs / composants) et diagramme de déploiement à deux phases :
[dossier d'architecture](../dossier/dossier-architecture-logicielle.md#5-diagrammes).

---

## Le prototype — pas une maquette

`docker compose up` → application + PostgreSQL + Redis + Mailhog, jeu de données préchargé, **zéro
installation manuelle**.

Parcours démontrables en direct :
- recherche → réservation → espace client,
- authentification 100 % clavier (MFA),
- mode dégradé (coupure réseau simulée → synchronisation automatique au retour),
- bascule RTL instantanée,
- back-office coiffeur, tableau de bord statistique.

---

## Performance — mesurée, pas supposée

Charge réelle (k6) contre le prototype démarré :

- **Recherche** (cache Redis, 500 utilisateurs simulés) : p95 = **419,6 / 366,4 ms** sur deux runs — large
  marge sous le seuil de 2s, stable même quand `reservation_burst` sature le reste du système.
- **Réservation en rafale** (150 utilisateurs contre 40 créneaux) : **0 double réservation**, conflits gérés
  proprement.

**Un vrai goulot trouvé, diagnostiqué, puis corrigé** : le hachage `scrypt` du mot de passe saturait le CPU
applicatif (377 % max, contre 9 % PostgreSQL et 6 % Redis) — pas un problème de cache ni de base de
données. p95 de `reservation_burst` dépassait le seuil (**3,44 s / 2,17 s**). Le réglage du threadpool
libuv (`UV_THREADPOOL_SIZE` 4→12) a été testé et **écarté** (aucun effet, CPU toujours plafonné à
330-350 %). La solution retenue et **déployée** : un serveur Next.js clusterisé (4 workers, module
`cluster` natif de Node — aucune brique externe ajoutée), qui ramène le p95 à **1,29 s / 1,21 s**, sous le
seuil, confirmé sur deux runs. Détail : [rapport de performance](../performance/rapport-performance.md) et
[ADR-002](../adr/0002-cache-cdn-async.md) (§ Constats).

---

## Accessibilité — auditée, pas déclarée

Audit RGAA 4 partiel (2 écrans clés) : scan automatisé (axe-core) + trace clavier automatisée + relecture
manuelle critère par critère + calcul direct des contrastes.

- **1 anomalie réelle trouvée et corrigée** pendant l'audit (structuration/régions de repérage).
- 0 violation automatisée résiduelle, tous les contrastes ≥ 6:1.
- Ordre de tabulation cohérent, focus toujours visible, aucun piège clavier.
- **1 non-conformité documentée et non corrigée** (titres de page dynamiques) — assumée comme hors
  périmètre de cet audit partiel plutôt que masquée.

Détail : [rapport RGAA](../accessibilite/rapport-rgaa.md).

---

## Risques résiduels

- **RTL tardif** — déjà testé dès le prototype, pas repoussé en fin de projet.
- **Portabilité cloud** — image conteneur identique en local et sur l'hébergeur cible, à valider avant
  d'écrire la moindre fonctionnalité métier supplémentaire.
- **MFA non accessible** — test manuel lecteur d'écran (NVDA/VoiceOver) encore à mener ; l'audit RGAA de ce
  projet reste partiel et automatisé/manuel-outillé, pas un test utilisateur réel.
- **Charge applicative en pic** — goulot diagnostiqué (CPU du hachage `scrypt`, pas le threadpool libuv) et
  **déjà corrigé** par clusterisation Node (`prototype/server.js`) ; la scalabilité horizontale (phase 2,
  cloud) reste la réponse si une seule instance clusterisée ne suffit plus.
- **Continuité hors-ligne partielle** — la resynchronisation dépend de l'événement réseau `online` ou d'une
  action manuelle pendant que l'app est ouverte ; sans l'API Background Sync, aucune resynchro automatique
  ne se produit si l'app est rouverte après coup.

---

## Ce qui reste ouvert

- Étendre WebAuthn/passkey (actuellement documenté comme cible, TOTP est le mécanisme fonctionnel du
  prototype).
- Implémenter l'API Background Sync pour une resynchronisation vraiment automatique en arrière-plan
  (actuellement : événement `online` ou action manuelle, app ouverte).
- Titres de page dynamiques par écran (RGAA 8.5).
- Test utilisateur réel avec lecteur d'écran.
- Validation de la portabilité cloud (phase 2 du diagramme de déploiement).

Chaque ADR reste **Proposée** — révisable dès qu'un compromis cesse d'être acceptable.

---

# Questions

Dossier complet, ADR, rapports et prototype : dépôt du projet.
