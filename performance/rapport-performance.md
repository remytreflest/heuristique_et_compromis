# Rapport d'analyse de performance

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

Pour rejouer le test en direct (dashboard web temps réel) : [`Watch-LoadTest.ps1`](Watch-LoadTest.ps1). Données
complètes (méthodologie, chiffres, code) et brief prêt à l'emploi pour produire la version PDF de ce
livrable : [`BRIEF-CLAUDE-WEB.md`](BRIEF-CLAUDE-WEB.md).

---

## 1. Contexte et méthodologie

### 1.1 Outil et environnement de mesure

Les tests de charge ont été exécutés avec k6 — un outil open-source de test de charge, dont les scénarios
s'écrivent en JavaScript et qui simule un grand nombre d'utilisateurs virtuels (VUs) envoyant des requêtes en
parallèle — contre le prototype réel (Next.js, PostgreSQL 16, Redis 7), orchestré via `docker-compose`, sur
un hôte de développement unique (Docker Desktop, Windows) hébergeant une seule instance de chaque service.
Cette topologie mono-instance est assumée comme une limite de la mesure (§4.1) : elle ne préjuge pas du
comportement d'une infrastructure cible répartie, mais elle permet d'isoler correctement où se situe le
goulot d'étranglement (§2.4).

### 1.2 Méthodologie de mesure

Six exécutions indépendantes ont été rejouées, réparties sur trois configurations successives : deux runs de
référence (§2.2), deux runs testant un réglage du threadpool Node (`UV_THREADPOOL_SIZE`, §2.4), puis deux
runs de confirmation après passage à un serveur Next.js clusterisé (§2.4). Chaque run est complété par des
relevés CPU / mémoire / E-S disque par conteneur (`docker stats`).

### 1.3 Scénarios rejoués

| Scénario | Modélise | Charge | Lien avec le brief |
|---|---|---|---|
| `recherche` | Trafic dominant lors d'un pic : consultation/recherche non authentifiée, assistée par le cache Redis | Montée à 500 VUs (20s), palier 30s, retombée 10s | Cible littérale de C2 : 500 utilisateurs simultanés |
| `reservation_burst` | Parcours complet (connexion + MFA réel par TOTP + réservation) en rafale sur un pool volontairement limité de 40 créneaux | Montée à 150 VUs (10s), palier 15s, retombée 5s, démarré à t+25s (chevauche `recherche`) | Modélise « l'ouverture des créneaux avant les fêtes » : stock fini soudainement disputé |

Environnement des runs : 1 hôte Docker Desktop (Windows), 1 instance de chaque service (app Next.js,
PostgreSQL 16, Redis 7).

`reservation_burst` inclut, à chaque itération, une connexion complète (mot de passe + code TOTP réel,
calculé en JavaScript k6 avec l'algorithme RFC 6238 — vérifié au préalable contre `otplib`) avant la
tentative de réservation : la mesure couvre le parcours utilisateur réel, pas seulement l'endpoint de
réservation isolé.

---

## 2. Analyse de scénarios critiques

Deux scénarios couvrent respectivement le trafic de lecture dominant et l'écriture contentieuse que le brief
cite explicitement.

### 2.1 Pic de charge — trafic de lecture (« recherche »)

500 VUs simultanés — trafic assisté par le cache Redis.

| Indicateur | Run A (17:27) | Run B (17:33) |
|---|---|---|
| p95 | **419,6 ms** | **366,4 ms** |
| moyenne | 148,5 ms | 133,3 ms |
| médiane | 133,5 ms | 101,1 ms |
| max | 731,8 ms | 624,1 ms |
| Seuil C2 (< 2 000 ms) | ✅ respecté, large marge | ✅ respecté, large marge |

Sur les deux runs, le p95 reste très en dessous du seuil des 2 000 ms, avec une marge confortable. Ce
scénario reste stable même lorsque `reservation_burst` sature le reste du système en parallèle (§2.2), ce qui
confirme l'efficacité du cache Redis sur ce chemin (§3.1).

### 2.2 Pic de charge — écriture contentieuse (« réservation en rafale »)

150 utilisateurs virtuels rejouent un parcours complet (connexion + MFA réel par TOTP + réservation) contre
un pool volontairement limité à 40 créneaux — la modélisation littérale de « l'ouverture des créneaux » du
brief : un stock fini soudainement disputé.

**Correction (priorité sur la latence).** Sur les deux runs, exactement 40 créneaux sur 40 sont confirmés,
jamais plus — vérifié directement en base après chaque exécution (requête en annexe, §5.2) : aucune double
réservation constatée.

```sql
SELECT "slotId", count(*) FROM "Appointment" GROUP BY "slotId" HAVING count(*) > 1;
-- 0 lignes sur tous les runs
```

Le surplus de demandes obtient un conflit HTTP 409 propre, jamais une erreur serveur généralisée. C'est une
garantie transactionnelle (transaction Prisma, vérification du statut du créneau + réservation atomique, voir
`src/app/api/appointments/route.ts`), indépendante de la latence traitée ci-dessous.

**Latence.** Sur les runs de référence, le p95 de l'endpoint de réservation (`POST /api/appointments`, hors
connexion/MFA) atteint 2,04 s puis 1,92 s — à la limite du seuil des 2 000 ms sur le premier run, en dessous
sur le second.

Endpoint de réservation seul (`POST /api/appointments`, hors connexion/MFA) — `booking_duration_ms` :

| Indicateur | Run A (17:27) | Run B (17:33) |
|---|---|---|
| p95 | 2,04 s | 1,92 s |
| moyenne | 1,40 s | 1,32 s |
| max | 2,19 s | 2,16 s |

Compteurs métier :

| Compteur | Run A | Run B |
|---|---|---|
| Réservations confirmées | 40 | 40 |
| Conflits 409 (attendus, sain) | 581 | 688 |
| Erreurs de réservation (`booking_error`) | 31 | 22 |
| Taux d'échec HTTP global (`http_req_failed`) | 2,25 % ❌ (seuil < 1 %) | 2,53 % ❌ (seuil < 1 %) |

### 2.3 Latence — vue consolidée des essais

Contrairement à l'endpoint de réservation seul présenté en §2.2, cette vue retient le p95 du parcours complet
de l'utilisateur (connexion + MFA + réservation) : c'est la seule métrique mesurée sur les trois
configurations testées — l'endpoint seul n'a été isolé que sur les runs de référence.

`reservation_burst` — p95 du parcours complet (connexion + MFA + réservation) à travers les trois
configurations testées :

| Indicateur | Runs A/B — référence | Runs C/D — `UV_THREADPOOL_SIZE=12` | Runs E/F — serveur clusterisé |
|---|---|---|---|
| p95 (parcours complet) | 3,44 s / 2,17 s | 2,78 s / 3,03 s | **1,29 s / 1,21 s** |
| Seuil C2 (< 2 000 ms) | ❌ dépassé | ❌ dépassé | ✅ respecté |
| `booking_error` | 31 / 22 | 37 / 6 | 5 / 26 |
| CPU max conteneur app | 377 % / 303 % | 334 % / 346 % | 1072 % / 1068 % |

Ce tableau consolide la trajectoire complète sur `reservation_burst` : les runs de référence dépassent le
seuil C2, l'essai de dimensionnement du threadpool (détail en §2.4) n'apporte aucun gain mesurable, et seul le
passage à un serveur clusterisé (détail en §2.4) ramène le p95 sous le seuil des 2 000 ms, sur deux runs de
confirmation.

Au sein d'une même configuration, l'écart entre les deux runs — par exemple `booking_error` : 31 puis 22 sur
les runs de référence, ou 37 puis 6 avec le threadpool élargi — illustre la sensibilité de ce scénario à la
charge résiduelle du poste de développement partagé (hôte unique, une seule instance de chaque service, §4.1),
plutôt qu'un problème à masquer. Ce qui reste stable malgré cette variance est le plus significatif : le p95
de `recherche` reste toujours sous 500 ms sur les six runs, et la garantie transactionnelle (0 double
réservation) reste constante sur toutes les configurations testées.

### 2.4 I/O — CPU applicatif vs disque/réseau

Relevés par conteneur pendant le run (`docker stats`, runs de référence) :

| Conteneur | CPU max | CPU moyen | Mémoire max | E-S disque pendant le run |
|---|---|---|---|---|
| app (Next.js) | 303 % – 377 % | 145 – 162 % | ~5 % | lecture quasi constante (~256 Mo, image/layers — pas de croissance liée au trafic) |
| db (PostgreSQL) | 6 % – 9 % | ~2,7 % | < 1 % | écriture disque de ~1 Mo sur tout le run (négligeable) |
| redis | 6 % | ~3 % | < 0,1 % | quasi nulle |

Le conteneur applicatif consomme jusqu'à 3 à 4 cœurs CPU complets pendant le pic, pendant que la base de
données et le cache restent quasiment inactifs. **Le goulot d'étranglement est un goulot CPU applicatif, pas
un goulot d'I/O disque ni un goulot base de données.** C'est cohérent avec le hachage de mot de passe
(`scrypt`, `prototype/src/lib/password.ts`) : asynchrone (il ne bloque plus la boucle d'événements) mais
reste un calcul lourd, exécuté sur le threadpool libuv (4 threads par défaut).

```
Runs A/B — référence            Runs C/D — UV_THREADPOOL_SIZE=12       Runs E/F — serveur clusterisé
p95 3,44 s / 2,17 s        →     p95 2,78 s / 3,03 s               →    p95 1,29 s / 1,21 s
seuil dépassé                    aucun gain mesurable                   seuil respecté
```

Trajectoire du diagnostic sur `reservation_burst` (p95 du parcours complet, vue consolidée en §2.3) :
dépassement mesuré sur les runs de référence, essai infructueux sur le dimensionnement du threadpool
ci-dessous, puis solution validée par le passage à un serveur Next.js clusterisé.

**Essai — dimensionnement du threadpool (`UV_THREADPOOL_SIZE`).** Hypothèse testée : le hachage `scrypt`
n'utilisant que 4 threads par défaut quel que soit le nombre de cœurs disponibles (12 sur la machine de
mesure), le relever à 12 devrait réduire la file d'attente sur ce threadpool et donc le p95 de
`reservation_burst`.

Référence (Run A/B) vs `UV_THREADPOOL_SIZE=12` (Run C 17:47 / Run D 17:49) :

| Indicateur | Référence | Avec threadpool à 12 |
|---|---|---|
| `reservation_burst` p95 (parcours complet) | 3,44 s / 2,17 s (moy. 2,81 s) | 2,78 s / 3,03 s (moy. 2,91 s) |
| `booking_error` | 31 / 22 | 37 / 6 |
| CPU max conteneur app | 377 % / 303 % | 334 % / 346 % |
| `recherche` p95 (témoin, sans scrypt) | 419,6 ms / 366,4 ms | 409,3 ms / 463,0 ms |

Aucune amélioration mesurable : la moyenne des p95 ne bouge pas significativement (2,81 s → 2,91 s, dans le
bruit inter-runs déjà observé entre les runs A et B eux-mêmes) et surtout, le CPU maximal du conteneur app
n'augmente pas vers les 1200 % théoriquement disponibles malgré trois fois plus de threads offerts au
threadpool — signe que la profondeur de ce threadpool n'était pas le facteur limitant réel. Le scénario
témoin `recherche` (qui n'appelle jamais `scrypt`) reste inchangé dans les deux configurations, ce qui
confirme que le réglage a bien été appliqué et isolé correctement : ce n'est pas un problème de méthode,
c'est un résultat négatif réel. La configuration a été repassée à sa valeur par défaut après ce test.

**Solution retenue — serveur Next.js clusterisé.** Hypothèse affinée après l'essai précédent : le plafond CPU
observé (jamais plus de ~350 % sur 1200 % disponibles, quel que soit `UV_THREADPOOL_SIZE`) ne vient pas d'un
manque de threads pour `scrypt`, mais de la capacité d'un **process Node unique** — une seule boucle
d'événements pour orchestrer les ~650 connexions concurrentes des deux scénarios combinés.
`prototype/server.js` démarre 4 processus worker via le module `cluster` de Node (`WEB_CONCURRENCY=4`),
chacun avec sa propre boucle d'événements et son propre threadpool ; l'OS répartit les connexions entrantes
entre eux. `DATABASE_URL` reçoit `?connection_limit=10` par précaution, pour éviter que 4 workers ne dépassent
`max_connections` sur PostgreSQL.

Runs de confirmation — serveur clusterisé (Run E 18:06 / Run F 18:08) :

| Indicateur | Run E | Run F |
|---|---|---|
| `reservation_burst` p95 (parcours complet) | **1,29 s** ✅ | **1,21 s** ✅ |
| `recherche` p95 | 319 ms ✅ | 307 ms ✅ |
| Réservations confirmées | 40/40 | 40/40 |
| `booking_error` | 5 | 26 |
| CPU max conteneur app | 1072 % (≈10,7 cœurs / 12) | 1068 % |
| CPU max conteneur db | 33 % | 24 % |
| Débit HTTP total | 514 req/s | 518 req/s |

Les deux seuils C2 (p95 < 2s) sont respectés sur les deux scénarios, sur deux runs indépendants. Le CPU
applicatif grimpe enfin vers la capacité réelle de la machine (12 cœurs), confirmant le diagnostic : c'était
bien une limite de parallélisme au niveau process, pas au niveau threadpool.

**Note sur le taux d'échec HTTP.** Le seuil auxiliaire du script k6 (`http_req_failed: rate<1%`) est
désormais dépassé (4,6-4,7 %), contre 2,1-2,5 % avant. Ce n'est pas une dégradation réelle : la latence bien
plus basse permet à chaque utilisateur virtuel de rejouer beaucoup plus d'itérations dans la même fenêtre de
30s (~1 460-1 480 conflits 409 contre ~580-690 avant, pour toujours exactement 40 réservations confirmées) —
et k6 comptabilise par défaut tout statut HTTP ≥ 400 dans `http_req_failed`, y compris les 409 de conflit qui
sont un comportement correct et attendu sous contention (§2.2). Le nombre d'erreurs réelles (`booking_error`)
reste bas (5 puis 26) et le taux de `checks` réussis reste à 99,98-99,99 %. C'est une limite du seuil de test
auto-imposé, pas de la contrainte C2 elle-même, qui ne porte que sur le temps de réponse.

---

## 3. Recommandations d'optimisation

Les recommandations suivent les trois familles citées par l'énoncé du livrable (cache, découplage, CDN),
complétées par les leviers CPU issus du diagnostic §2.4 — présentés dans l'ordre où ils ont été testés, pas
comme une liste de choix a priori.

### 3.1 Cache — [ADR-002](../adr/0002-cache-cdn-async.md)

Le cache Redis sur les disponibilités de créneaux est déjà en place et déjà validé par les mesures : le
trafic de lecture reste stable et largement sous le seuil à 500 VUs (§2.1), y compris lorsque
`reservation_burst` sature le reste du système. Aucune action n'est requise à ce volume — c'est un choix
d'architecture qui a payé, pas un manque à combler.

### 3.2 CDN — [ADR-002](../adr/0002-cache-cdn-async.md)

Un CDN en frontal des pages publiques (recherche, fiches salon) est prévu par l'architecture pour absorber le
trafic de lecture et les pics anormaux. Deux niveaux sont à distinguer ici.

Le **mécanisme** qu'un CDN utiliserait pour ce trafic — servir une réponse déjà en cache HTTP en périphérie
de l'application plutôt que de solliciter le process Node — est mesurable en local et a été mesuré : un
reverse-proxy nginx (`performance/nginx-cdn.conf`, service `cdn` du `docker-compose.yml`) a été placé devant
l'application, ne cachant que `GET /api/search` (seul trafic public non authentifié du prototype, BF-03),
avec un TTL de 30s aligné sur celui du cache applicatif Redis déjà en place (ADR-002) plutôt que gonflé pour
obtenir un meilleur chiffre. Le scénario `recherche` (500 VUs) a été rejoué en direct puis à travers ce
cache, avec `reservation_burst` comme témoin — il ne traverse jamais la route cachée.

Latence — direct vs à travers le cache HTTP (`performance/nginx-cdn.conf`) :

| Indicateur | Direct, sans cache HTTP | À travers le cache HTTP (nginx) |
|---|---|---|
| `recherche` p95 | 459,6 ms | **3,4 ms** |
| `recherche` moyenne | 130,2 ms | 1,4 ms |
| `recherche` médiane | 60,6 ms | 0,5 ms |
| `reservation_burst` p95 (témoin, chemin non caché) | 1,67 s | 1,98 s |
| Réservations confirmées (témoin) | 40/40 | 40/40 |

Statuts de cache nginx (`$upstream_cache_status`) sur le run à travers le proxy :

| Statut | Occurrences |
|---|---|
| HIT | 29 892 |
| MISS | 48 |
| EXPIRED | 49 |
| UPDATING | 166 |

Taux de cache-hit global : **99,1 %** (29 892 / 30 155). Le nombre de MISS (48) correspond exactement aux 48
combinaisons uniques service × ville × langue du script de charge (3 services × 4 villes × 4 langues) — un
seul miss par combinaison, ce qui confirme que la clé de cache est correcte (pas de collision, pas de
sur-cache). La légère hausse du témoin `reservation_burst` (1,67 s → 1,98 s) n'est pas un effet du cache — ce
chemin ne le traverse pas — mais la variance inter-runs déjà documentée (§4.1).

La **valeur propre d'un CDN en production** — distribution géographique réduisant la latence WAN pour des
utilisateurs dispersés, absorption de volumétrie anormale à l'échelle internet — reste hors de portée d'une
mesure locale : aucune topologie réseau réelle ni échelle de trafic internet sur un hôte Docker Desktop en
loopback. C'est donc toujours une recommandation architecturale sur ce point, mais désormais appuyée par une
preuve de mécanisme plutôt qu'une simple affirmation non testée.

### 3.3 Découplage — [ADR-002](../adr/0002-cache-cdn-async.md)

Les notifications (email/SMS) sont déjà sorties du chemin critique de réservation via une file asynchrone, ce
qui protège la latence de l'endpoint mesuré (`booking_duration_ms`, §2.2) de tout traitement non essentiel à
la confirmation. Le même principe est à étendre si d'autres traitements non critiques venaient rejoindre le
chemin de réservation à l'avenir.

### 3.4 Leviers CPU — de `UV_THREADPOOL_SIZE` au clustering

Le diagnostic du goulot CPU applicatif (§2.4) mène à quatre leviers, classés par ordre de coût croissant et
présentés selon leur cheminement réel — testé et écarté, testé et validé, ou réservé pour une phase
ultérieure — plutôt que comme une liste de choix a priori.

| Levier | Statut | Constat | Recommandation |
|---|---|---|---|
| `UV_THREADPOOL_SIZE` (4→12) | Testé — écarté | p95 quasi identique (2,81s→2,91s), CPU applicatif toujours plafonné à ~330-350 % au lieu de 300-377 %, loin des 1200 % disponibles (§2.4) | Non retenu — ce n'est pas le levier qui fait passer sous 2s |
| Clustering Node (module `cluster`, 4 workers) | Testé — validé | p95 `reservation_burst` : 3,44s/2,17s → 1,29s/1,21s ; CPU applicatif jusqu'à ~1070 % (§2.4) | **Solution retenue pour ce rapport** |
| Scalabilité horizontale (plusieurs instances + répartiteur de charge) | Prévu — phase cloud | Prolonge au niveau infrastructure ce que le clustering apporte au niveau process | Pertinent si la demande dépasse un jour la capacité d'une seule machine multi-cœurs ; non nécessaire au volume testé ici (500 + 150 VUs tiennent déjà sur une seule instance clusterisée) |
| File d'attente virtuelle (« salle d'attente ») | En réserve | — | À garder en réserve si la demande dépasse durablement la capacité mesurée lors d'un futur pic plus important que celui testé ici |

> **[ADR-002](../adr/0002-cache-cdn-async.md) — Révision, constat issu des tests de charge de ce rapport.**
> La clause de révision d'ADR-002 (cache / CDN / traitement asynchrone) anticipait qu'un dépassement du seuil
> de 2s sous charge mènerait à l'introduction d'une file d'attente virtuelle en amont du flux de réservation.
> Les tests de charge ont bien confirmé ce dépassement (§2.2, §2.3), mais ont isolé une cause différente de
> celle anticipée : le cache Redis a tenu sa promesse (`recherche` toujours sous 500 ms, y compris sous
> tension, §2.1) — ce n'était pas une insuffisance du cache, mais un plafond de capacité CPU du process
> applicatif (§2.4). La solution retenue (serveur Next.js clusterisé) répond donc à la cause réelle plutôt
> qu'à celle supposée par la clause de révision initiale — c'est le fonctionnement normal d'une clause de
> révision : elle a correctement déclenché l'investigation, et la mesure a affiné le diagnostic. Cette
> solution reste dans le périmètre du socle restreint ([ADR-007](../adr/0007-socle-technique-restreint.md) —
> `cluster` est natif à Node, aucune nouvelle brique introduite) et dans celui du scaling vertical déjà
> anticipé comme compromis assumé par [ADR-001](../adr/0001-monolithe-modulaire.md). La file d'attente
> virtuelle reste la réponse à privilégier si un futur pic dépasse la capacité désormais mesurée d'une seule
> instance clusterisée.

---

## 4. Limites de la mesure et bilan

### 4.1 Limites retenues

- Un seul hôte de développement partagé, une seule instance de chaque service, pas de répartition de charge
  — les valeurs absolues ne préjugent pas de l'infrastructure cible, mais le diagnostic (CPU applicatif, pas
  I/O disque/DB) est transposable.
- Deux exécutions par configuration, pas une série statistique — les chiffres sont des ordres de grandeur,
  pas des moyennes stabilisées ; la variance observée entre runs (§2.3) illustre justement cette limite
  plutôt que de la masquer.
- CDN : le mécanisme de cache HTTP a été mesuré en local (§3.2) ; la valeur propre d'un CDN réel (distribution
  géographique, absorption de trafic à l'échelle internet) reste hors de portée d'une mesure locale —
  recommandation architecturale sur ce point précis.

### 4.2 Bilan vis-à-vis de C2

Le seuil C2 (p95 < 2s à 500 VUs) est désormais **respecté sur les deux scénarios**, y compris sur
`reservation_burst` (1,29 s puis 1,21 s sur deux runs indépendants après le passage au serveur clusterisé,
§2.4). Ce n'est plus une recommandation à mettre en œuvre : c'est un résultat mesuré et confirmé, obtenu
après une trajectoire de diagnostic complète (dépassement → diagnostic → essai infructueux → solution
validée) plutôt qu'acquis d'emblée.

---

## 5. Annexe

### 5.1 Tableau consolidé des runs

| Run | Configuration | `recherche` p95 | `reservation_burst` p95 (parcours complet) | `booking_error` | CPU max (app) |
|---|---|---|---|---|---|
| A (17:27) | Référence | 419,6 ms | 3,44 s | 31 | 377 % |
| B (17:33) | Référence | 366,4 ms | 2,17 s | 22 | 303 % |
| C (17:47) | `UV_THREADPOOL_SIZE=12` | 409,3 ms | 2,78 s | 37 | 334 % |
| D (17:49) | `UV_THREADPOOL_SIZE=12` | 463,0 ms | 3,03 s | 6 | 346 % |
| E (18:06) | Serveur clusterisé | 319 ms | 1,29 s | 5 | 1072 % |
| F (18:08) | Serveur clusterisé | 307 ms | 1,21 s | 26 | 1068 % |

### 5.2 Requête SQL de vérification anti-double-réservation

Exécutée en base après chaque run de `reservation_burst` — 0 ligne retournée sur les six runs.

```sql
SELECT "slotId", count(*) FROM "Appointment" GROUP BY "slotId" HAVING count(*) > 1;
-- 0 lignes sur tous les runs
```

Configuration du cache HTTP testée en §3.2 : [`performance/nginx-cdn.conf`](nginx-cdn.conf).
