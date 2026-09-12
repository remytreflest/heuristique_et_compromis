# Plateforme de prise de rendez-vous en salon de coiffure

Projet d'architecture logicielle : accessibilité numérique, performance, expérience utilisateur et
adaptabilité aux besoins métier d'une chaîne régionale de salons de coiffure. Brief d'origine :
[architecture-logicielle-projet_1.md](architecture-logicielle-projet_1.md).

## Lancer le prototype

```bash
docker compose up
```

- Application : http://localhost:3001 (port hôte 3001 pour éviter un conflit avec le port 3000, souvent
  déjà pris par un autre projet local — l'app écoute sur le port 3000 à l'intérieur du conteneur)
- Notifications simulées (Mailhog) : http://localhost:8025
- Comptes de démonstration, parcours à tester, choix de fidélité assumés : voir
  [prototype/README.md](prototype/README.md)

## Comment le projet est structuré

```
architecture-logicielle-projet_1.md   Brief d'origine (besoins, contraintes, livrables attendus)
plan-architecture.md                  Cadrage : lecture des contraintes, tensions T1–T7, diagrammes, socle
adr/                                  Une décision d'architecture par tension (ADR-0001 à 0007)
bf/                                   Besoins fonctionnels détaillés, critères d'acceptation, traçabilité
pu/                                   Parcours utilisateur (nominal, réseau dégradé, clavier, professionnel)
dossier/                              Dossier d'architecture logicielle assemblé (livrable 1)
prototype/                            Prototype Next.js + PostgreSQL + Redis + Mailhog (livrable 5)
docker-compose.yml                    Lance l'ensemble du prototype, à la racine du dépôt
performance/                          Script de charge k6 + rapport (livrable 2)
  Watch-LoadTest.ps1                  Rejoue le test de charge en direct (dashboard web + CPU/mem live)
  BRIEF-CLAUDE-WEB.md                 Brief + données mesurées, à donner à claude.ai pour générer le PDF
  results/                            Résultats bruts des runs (JSON/CSV, ignoré par git)
accessibilite/                        Outillage d'audit (axe-core/Playwright) + rapport RGAA (livrable 3)
soutenance/                           Trame de présentation (livrable 4)
```

## Fil de lecture recommandé

1. [plan-architecture.md](plan-architecture.md) — les tensions T1–T7 et les heuristiques retenues, fil rouge
   de tout le reste.
2. [adr/](adr/README.md) — le détail de chaque décision (options comparées, compromis, condition de
   révision).
3. [bf/besoins-fonctionnels.md](bf/besoins-fonctionnels.md) et
   [pu/parcours-utilisateur.md](pu/parcours-utilisateur.md) — ce que chaque décision rend possible, du
   point de vue de l'utilisateur.
4. [dossier/dossier-architecture-logicielle.md](dossier/dossier-architecture-logicielle.md) — la synthèse
   soumissible.
5. Le prototype en marche (`docker compose up`), et les deux rapports mesurés
   ([performance](performance/rapport-performance.md), [accessibilité](accessibilite/rapport-rgaa.md)) qui
   en découlent directement — les deux anomalies qu'ils documentent ont été trouvées *et corrigées* pendant
   ce projet, pas simulées.
