# Rapport d'analyse de performance

> **Mise à jour 2026-09-09** : six runs frais supplémentaires ont été mesurés, avec cette fois des
> relevés CPU/mémoire/E-S par conteneur (`docker stats`) pendant la charge — analyse I/O absente de
> ce document. Les deux premiers montrent un dépassement du seuil de 2s sur `reservation_burst`
> (variance par rapport aux chiffres ci-dessous, cf. §5 — pas une régression : ce document
> documentait déjà un dépassement bien plus sévère sur cette même métrique, ~30s, en §3.3). Deux
> runs suivants testent l'hypothèse `UV_THREADPOOL_SIZE` évoquée en recommandation n°2 (§4) :
> relevée à 12, **sans gain mesurable**. Les deux derniers testent un serveur Next.js **clusterisé**
> (`prototype/server.js`, 4 workers) : p95 de `reservation_burst` descend à **1,29s puis 1,21s**,
> **sous le seuil des 2s sur les deux runs**. Données complètes (méthodologie, chiffres, code) et
> brief prêt à l'emploi pour produire la version PDF de ce livrable :
> [`BRIEF-CLAUDE-WEB.md`](BRIEF-CLAUDE-WEB.md). Pour rejouer le test en direct (dashboard web temps
> réel) : [`Watch-LoadTest.ps1`](Watch-LoadTest.ps1).
>
> **Mise à jour 2026-09-10** : le rapport affirmait jusqu'ici que le CDN (recommandation ADR-002)
> n'était pas mesurable en local, sans plus de nuance. Distinction ajoutée : le **mécanisme** de
> cache HTTP en périphérie qu'un CDN utiliserait pour le trafic public est mesurable et a été
> mesuré, via un reverse-proxy nginx (`performance/nginx-cdn.conf`, service `cdn` du
> `docker-compose.yml`, port 8080) placé devant l'app avec cache limité à `/api/search` — p95 de
> `recherche` passe de 459,6 ms (direct) à 3,4 ms (à travers le cache), taux de cache-hit 99,1 %.
> Ce qui reste réellement hors de portée d'une mesure locale, c'est la valeur propre d'un CDN
> (édge géographique, absorption volumétrique internet) — la recommandation CDN de la section 4
> reste donc architecturale sur ce point précis, mais appuyée désormais par une preuve de
> mécanisme. Détail complet : [`BRIEF-CLAUDE-WEB.md`](BRIEF-CLAUDE-WEB.md) §6.8 et
> [ADR-002](../adr/0002-cache-cdn-async.md) (constat daté du même jour).

Ce rapport ne projette pas des chiffres hypothétiques : il documente une charge **réelle**, exécutée avec
[k6](https://k6.io) contre le prototype [`docker-compose`](../docker-compose.yml) tel qu'il tourne
effectivement (Next.js + PostgreSQL + Redis + Mailhog), sur les deux parcours critiques identifiés par la
contrainte C2 du brief :

> *« Le système doit supporter 500 utilisateurs simultanés lors de pics (ex : ouverture des créneaux avant
> les fêtes de fin d'année), tout en garantissant un temps de réponse < 2s. »*

Script complet : [`k6-scenario.js`](k6-scenario.js). Reproductible avec le prototype démarré (`docker compose
up` depuis la racine) puis :

```bash
docker run --rm --network heuristique_et_compromis_default \
  -v "$(pwd)/performance:/scripts" grafana/k6 run -e BASE_URL=http://app:3000 /scripts/k6-scenario.js
```

**Limite assumée** : mesures prises sur un poste de développement local (Docker Desktop, 1 seule instance
de l'application), pas sur l'infrastructure cible. Les ordres de grandeur et le diagnostic sont
transposables, les valeurs absolues ne le sont pas — c'est expliqué en section 5.

---

## 1. Scénarios rejoués

| Scénario | Ce qu'il modélise | Charge | Lien avec le brief |
|---|---|---|---|
| `recherche` | Trafic dominant lors d'un pic : consultation/recherche, non authentifiée, assistée par le cache Redis | Montée à 500 VUs (20s), palier 30s à 500 VUs, retombée 10s | Cible littérale de C2 : 500 utilisateurs simultanés |
| `reservation_burst` | Le sous-ensemble qui va au bout d'une réservation, en rafale sur un pool **volontairement limité** de 40 créneaux | Montée à 150 VUs (10s), palier 15s, retombée 5s, démarré à t+25s (chevauche `recherche`) | Modélise littéralement « l'ouverture des créneaux avant les fêtes » : un stock fini soudainement disputé |

`reservation_burst` inclut, à chaque itération, une connexion complète (mot de passe + code TOTP réel,
calculé en JavaScript k6 avec l'algorithme RFC 6238 — vérifié au préalable contre `otplib`) avant la
tentative de réservation : la mesure couvre le parcours utilisateur réel, pas seulement l'endpoint de
réservation isolé.

---

## 2. Résultat — Recherche (BF-03, cache Redis, ADR-002)

| Indicateur | Résultat mesuré |
|---|---|
| p95 temps de réponse | **925 ms – 957 ms** (deux exécutions), sous les 500 VUs |
| Seuil C2 (< 2s) | ✅ Respecté avec marge, y compris pendant que `reservation_burst` sature l'authentification en parallèle (section 3) |
| Taux d'erreur | ~0 % (échecs résiduels uniquement en toute fin de retombée de charge) |

Le cache Redis (`getCachedSearch` / `setCachedSearch`, TTL 30s) absorbe l'essentiel de la charge répétée :
la recherche reste rapide et **stable même quand le reste du système est sous tension**, ce qui valide
l'isolation recherchée par [ADR-002](../adr/0002-cache-cdn-async.md).

---

## 3. Résultat — Réservation en rafale (BF-04, ADR-004)

### 3.1 Garantie de correction sous contention (le résultat le plus important)

Avant tout chiffre de latence : la propriété qui compte le plus ici est l'absence de double réservation.
Vérifié directement en base après chaque exécution :

```sql
SELECT "slotId", count(*) FROM "Appointment" GROUP BY "slotId" HAVING count(*) > 1;
-- 0 lignes, sur les deux exécutions (avant/après correctif)
```

Sur un pool de 40 créneaux disputé par 150 utilisateurs simultanés : **exactement 40 réservations
confirmées, jamais plus**, le reste obtenant un conflit 409 propre (`booking.conflictBody`) plutôt qu'une
double réservation ou une erreur serveur. La transaction Prisma (vérification du statut du créneau +
réservation atomique, voir `src/app/api/appointments/route.ts`) tient sa promesse sous charge réelle, pas
seulement en test unitaire.

### 3.2 Un vrai goulot d'étranglement trouvé — et corrigé pendant cette analyse

La première exécution a révélé une latence anormale (p95 du parcours complet : **24,8 s**, très au-dessus du
seuil C2). Diagnostic : `src/lib/password.ts` utilisait `scryptSync`, un appel **synchrone et coûteux en
CPU**, dans le gestionnaire de requête `/api/auth/login`. Node.js étant mono-thread pour l'exécution JS,
chaque hachage de mot de passe bloquait entièrement la boucle d'événements — sous 150 connexions
concurrentes, les hachages se mettaient en file sur ce seul thread et faisaient s'effondrer la latence de
**toutes** les requêtes en cours, recherche comprise en théorie (T2 menacé par un détail d'implémentation de
T3).

**Correctif appliqué immédiatement** : `scrypt` asynchrone (`node:crypto` + `util.promisify`, déchargé sur le
threadpool libuv) au lieu de `scryptSync`. Comparaison mesurée avant/après :

| Indicateur | Avant (scrypt sync) | Après (scrypt async) | Écart |
|---|---|---|---|
| Latence de l'endpoint réservation seul (p95) | 6,37 s | **1,70 s** | −73 % |
| Latence de l'endpoint réservation seul (moyenne) | 2,88 s | **0,65 s** | −77 % |
| Échecs de réservation (`booking_error`) | 30 | **2** | −93 % |
| Réservations confirmées | 40 / 40 | 40 / 40 | inchangé (correct dans les deux cas) |
| p95 recherche pendant la même charge | 925 ms | 957 ms | stable |

### 3.3 Ce que le correctif change — et ne change pas

Le correctif isole les domaines de panne (`recherche` reste rapide et stable pendant que `reservation_burst`
sature l'authentification, y compris après le correctif) et divise par 3–4 la latence de l'endpoint de
réservation lui-même. Il ne fait en revanche pas disparaître la latence globale du parcours connexion + MFA
+ réservation sous 150 connexions simultanées (p95 encore proche de 30 s) : `scrypt` déchargé reste un calcul
coûteux exécuté sur le threadpool libuv de Node, dont la taille par défaut (4 threads) devient le facteur
limitant à ce niveau de concurrence — un problème de **capacité**, plus un problème de **blocage**. C'est une
distinction importante pour la suite (section 4).

---

## 4. Recommandations d'optimisation

1. **(Fait pendant cette analyse)** Hachage de mot de passe asynchrone — cf. section 3.2. À rétroporter dans
   toute future route qui réutiliserait `scryptSync` ou un équivalent bloquant.
2. **Dimensionner le threadpool libuv** (`UV_THREADPOOL_SIZE`) au nombre de cœurs disponibles côté
   hébergement, plutôt que la valeur par défaut (4) — première étape peu coûteuse avant tout
   sur-provisionnement (cohérent avec T7 : régler l'existant avant d'ajouter une brique).
3. **Absorber le pic d'authentification par la scalabilité horizontale de la phase 2 cloud** (ADR-001,
   diagramme de déploiement à deux phases dans `plan-architecture.md` §3.5) plutôt que par un
   sur-provisionnement permanent du mutualisé phase 1 — le pic MFA visé par C2 (« ouverture des créneaux
   avant les fêtes ») est ponctuel et prévisible, donc un candidat naturel à une bascule cloud élastique.
4. **File d'attente virtuelle** si la demande dépasse la capacité mesurée (risque déjà identifié dans
   `plan-architecture.md` §6, confirmé concrètement ici) : plus adapté qu'un sur-provisionnement permanent
   pour un pic saisonnier.
5. Le cache Redis + CDN (ADR-002) fonctionnent comme prévu pour le trafic de lecture — aucune action requise
   à ce niveau au volume testé.

---

## 5. Limites de la mesure

- Un seul hôte Docker Desktop local, une seule instance applicative, pas de répartition de charge : les
  valeurs absolues (notamment le p95 à 30 s de la section 3.3) ne préjugent pas du comportement sur
  l'infrastructure cible — mais le **diagnostic** (blocage puis limite de capacité du threadpool) est un
  résultat d'architecture transposable indépendamment du matériel.
- Chaque scénario a été exécuté deux fois (avant/après correctif), pas répété statistiquement : les chiffres
  sont des ordres de grandeur mesurés, pas des moyennes stabilisées sur de multiples runs.
- Le pool de 40 créneaux et 150 VUs de contention est un choix délibéré pour forcer des conflits observables
  (modéliser « tout le monde clique sur le même lot de créneaux ») — un pool plus large donnerait un taux de
  conflit plus faible sans changer le diagnostic de la section 3.2.
