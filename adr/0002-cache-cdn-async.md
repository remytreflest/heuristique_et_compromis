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

### Constat 2026-09-09 — tests de charge exécutés

Les tests de charge ont bien révélé un dépassement du seuil de 2s sur `reservation_burst` (150 VUs), comme
cette clause l'anticipait — mais le diagnostic mesuré ne pointe pas vers une insuffisance du cache. `recherche`
(le scénario qui dépend du cache Redis) est resté sous 500ms sur tous les runs, y compris pendant que
`reservation_burst` sature le reste du système : le cache tient sa promesse. Le dépassement venait d'un
plafond de capacité **CPU** du process applicatif (hachage `scrypt` du mot de passe) — plafonné à ~330-350%
de CPU sur 1200% disponibles, y compris après avoir testé `UV_THREADPOOL_SIZE` à 12 sans aucun effet. Un
problème de parallélisme au niveau process, pas de cache insuffisant. Détail complet, chiffres et méthode :
[`performance/BRIEF-CLAUDE-WEB.md`](../performance/BRIEF-CLAUDE-WEB.md) §6.3–§6.7 et
[`performance/rapport-performance.md`](../performance/rapport-performance.md).

En conséquence, la solution retenue n'est **pas** la file d'attente virtuelle prévue ci-dessus, mais un serveur
Next.js clusterisé (module `cluster` natif de Node, [`prototype/server.js`](../prototype/server.js), 4
workers) : p95 de `reservation_burst` passe de 3,44s/2,17s à **1,29s/1,21s** sur deux runs de confirmation,
sous le seuil des 2s. Cette solution reste dans le périmètre du socle restreint (ADR-007 — `cluster` est
natif à Node, aucune nouvelle brique introduite) et dans celui du scaling vertical déjà anticipé comme
compromis assumé par ADR-001. La file d'attente virtuelle décrite ci-dessus reste la réponse à privilégier
si un futur pic dépasse la capacité désormais mesurée d'une seule instance clusterisée, plutôt qu'un
sur-provisionnement permanent.

### Constat 2026-09-10 — mécanisme de cache HTTP mesuré en local (CDN toujours pas mesuré en tant que tel)

La recommandation CDN ci-dessus restait, jusqu'ici, non mesurée en charge — un `docker-compose`
local n'a ni points de présence géographiques ni volumétrie internet réelle à opposer à un CDN. Ce
qui est mesurable en local, en revanche, c'est le **mécanisme** qu'un CDN utiliserait pour le
trafic public (`recherche`, BF-03) : servir une réponse déjà en cache HTTP en périphérie plutôt que
de solliciter l'application. Un reverse-proxy nginx (`performance/nginx-cdn.conf`, service `cdn`
dans `docker-compose.yml`, port 8080) a été ajouté devant `app` avec un cache HTTP limité à
`/api/search`, TTL 30s (aligné sur le cache Redis existant plutôt que plus agressif).

Rejoué avec le même script de charge (`k6-scenario.js`, 500 VUs) en comparaison directe (port 3001,
sans cache HTTP) vs à travers le proxy (port 8080) : p95 de `recherche` passe de **459,6 ms à
3,4 ms**, taux de cache-hit de **99,1 %** (48 MISS = exactement les 48 combinaisons uniques
service×ville×langue possibles, un seul miss par combinaison — confirme que la clé de cache est
correcte). Détail complet : `performance/rapport-performance.md` et
`performance/BRIEF-CLAUDE-WEB.md` §6.8.

**Ce que ça change** : la recommandation CDN n'est plus une hypothèse non testée — son mécanisme de
base (cache HTTP en périphérie du trafic de lecture public) est démontré fonctionnel et efficace sur
ce trafic. **Ce que ça ne change pas** : un vrai CDN reste hors de portée d'une mesure locale sur sa
valeur propre (distribution géographique, absorption volumétrique à l'échelle internet contre un
trafic anormal/DDoS) — la recommandation d'adopter un CDN en production reste architecturale,
appuyée désormais par une preuve de mécanisme plutôt qu'une simple affirmation.
