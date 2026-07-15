# Rapport d'accessibilité RGAA 4 (audit partiel)

Audit partiel — au sens du livrable « Simuler un audit partiel RGAA pour une page/écran clé » — mené sur les
deux écrans retenus dans [pu/parcours-utilisateur.md](../pu/parcours-utilisateur.md#6-synthèse--couverture-des-livrables) :
**Recherche** et **Connexion / MFA**, ces deux écrans concentrant le risque de blocage clavier le plus élevé
(contrainte C3, [ADR-003](../adr/0003-mfa-accessible.md)). Contre le prototype `docker-compose` réellement
démarré, pas une maquette statique.

**Méthode** : trois sources de preuve, combinées volontairement — un outil automatisé ne couvre qu'une partie
des critères RGAA (les tests de compréhension, de pertinence sémantique et de logique de parcours restent
manuels par nature) :

1. **Scan automatisé** [axe-core](https://github.com/dequelabs/axe-core) 4.10 (règles WCAG 2.0 A/AA,
   WCAG 2.1 AA, bonnes pratiques), via Playwright/Chromium — [`axe-scan.mjs`](axe-scan.mjs), résultats bruts
   dans `accessibilite/results/*.json` (non versionnés, reproductibles par `npm run scan`).
2. **Trace clavier automatisée** : simulation de `Tab` répétés, capture de l'élément focus à chaque étape et
   du style `outline` calculé — vérifie l'ordre de tabulation et la visibilité réelle du focus, deux points
   qu'un scanner statique ne peut pas évaluer.
3. **Relecture manuelle** critère par critère (section 3), et calcul direct des ratios de contraste des
   couleurs du design system (section 2.3).

---

## 1. Résultats automatisés (axe-core)

| Écran | Violations | Règles passées |
|---|---|---|
| Recherche (FR) | 0 | 43 |
| Recherche (AR, RTL) | 0 | 43 |
| Connexion, étape 1 — identifiants (FR) | 0 | 40 |
| Connexion, étape 2 — code MFA (FR) | 0 | 40 |

### Anomalie trouvée puis corrigée pendant cet audit

Le premier passage a détecté 1 violation (impact *modéré*, règle `region` — « Ensure all page content is
contained by landmarks ») sur les **trois** écrans : le pied de page (mention « prototype pédagogique »)
était rendu directement dans `<body>`, hors de toute région de repérage (`<header>`, `<main>`, ou
équivalent). Un lecteur d'écran en navigation par régions ne pouvait pas l'atteindre normalement.

**Correction appliquée** : le contenu a été déplacé dans un élément `<footer>` (`src/app/[locale]/layout.tsx`),
qui constitue une région de repérage `contentinfo` standard. Deuxième passage : 0 violation. C'est le
résultat concret attendu de ce livrable — pas une simulation, une vraie non-conformité trouvée et corrigée.

## 2. Vérifications complémentaires (hors du périmètre d'axe-core)

### 2.1 Ordre de tabulation et visibilité du focus

Trace clavier (8 premiers `Tab` sur Recherche, 5 sur Connexion étape 1, 3 sur l'étape MFA) :

| Écran | Ordre observé | Focus visible (`outline`) |
|---|---|---|
| Recherche | Lien d'évitement → nom du site → Rechercher → Connexion → Créer un compte → sélecteur de langue (FR/EN/AR) | `solid` à chaque étape, jamais `none` |
| Connexion, étape 1 | Lien d'évitement → nom du site → Rechercher → Connexion → Créer un compte | `solid` à chaque étape |
| Connexion, étape 2 (MFA) | Le champ de code reçoit le focus automatiquement à l'apparition de l'étape (`autoFocus`, vérifié : le premier `Tab` part bien du champ de code vers le bouton « Vérifier le code ») ; le `Tab` suivant sort du contenu de page (fin de document, comportement normal du navigateur) puis boucle sur le lien d'évitement | `solid` |

Aucune perte de focus réelle, aucun piège clavier (RGAA 7.3 — « pièges au clavier »), ordre de tabulation
cohérent avec l'ordre visuel (RGAA 12.6/12.8). Le passage automatique du focus sur le champ de code à la
transition étape 1 → étape 2 confirme le critère d'acceptation BF-02 (« un échec sur le second facteur ne
fait pas perdre la saisie déjà validée du premier ») du point de vue clavier : l'utilisateur atterrit
directement là où il doit agir, sans avoir à re-parcourir la page.

### 2.2 Lien d'évitement (RGAA 12.7)

Premier élément focusable de chaque écran testé : « Aller au contenu » (FR), rendu localisé également en
anglais et arabe (`src/app/[locale]/layout.tsx`). Fonctionnel — vérifié par la trace ci-dessus.

### 2.3 Contrastes de couleurs (RGAA 3.2, 3.3)

axe-core inclut la règle `color-contrast` (seuils WCAG AA) dans les tags exécutés et n'a remonté aucune
violation. Calcul direct (fonction de luminance relative WCAG) des paires de couleurs du design system
(`src/app/globals.css`) pour vérification indépendante :

| Paire | Ratio | Seuil applicable | Résultat |
|---|---|---|---|
| Texte bouton (blanc) / fond bouton primaire | 7,10:1 | 4,5:1 (texte normal) | ✅ |
| Texte principal / fond de page | 17,40:1 | 4,5:1 | ✅ |
| Anneau de focus / fond blanc | 6,18:1 | 3:1 (composant non textuel) | ✅ |
| Texte « en attente de synchronisation » / fond | 6,68:1 | 4,5:1 | ✅ |
| Texte bandeau d'erreur (blanc) / fond | 15,50:1 | 4,5:1 | ✅ |
| Liens d'en-tête / fond | 17,40:1 | 4,5:1 | ✅ |
| Texte pied de page (atténué) / fond | 7,15:1 | 4,5:1 | ✅ |

Toutes les paires testées dépassent largement les seuils AA — marge volontaire, cohérente avec le persona
« client malvoyant » de [pu/parcours-utilisateur.md](../pu/parcours-utilisateur.md#1-personas).

---

## 3. Relecture manuelle par thématique RGAA 4

Sous-ensemble de critères pertinents pour ces deux écrans (thématiques sans objet — cadres, tableaux de
données, multimédia — ne sont pas listées : aucun de ces composants n'est présent sur Recherche ou
Connexion/MFA).

| Thématique | Critère (RGAA 4) | Constat | Statut |
|---|---|---|---|
| 1. Images | 1.1 Chaque image a-t-elle une alternative textuelle ? | L'icône `icon.svg` porte `role="img"` + `aria-label` ; aucune image porteuse d'information sur ces deux écrans | C |
| 3. Couleurs | 3.2 / 3.3 Contraste texte / composants d'interface suffisant ? | Voir section 2.3 : tous les ratios mesurés ≥ 6:1 | C |
| 3. Couleurs | 3.1 L'information n'est-elle pas donnée uniquement par la couleur ? | Les statuts de rendez-vous combinent texte (« Confirmé », « En attente de synchronisation »...) et couleur, jamais couleur seule | C |
| 6. Liens | 6.1 Chaque lien est-il explicite hors contexte ? | Libellés de navigation explicites (« Rechercher », « Mon espace »...) ; pas de « cliquez ici » | C |
| 7. Scripts | 7.1 Chaque script est-il compatible avec les technologies d'assistance ? | Formulaires en React contrôlé, pas de manipulation DOM hors du modèle d'accessibilité natif ; boutons/`<label htmlFor>` natifs plutôt que des `<div onClick>` | C |
| 7. Scripts | 7.3 Pas de piège au clavier ? | Confirmé par la trace clavier (section 2.1) | C |
| 8. Éléments obligatoires | 8.3 Langue de la page correctement indiquée ? | `<html lang={locale}>` posé dynamiquement par écran (`fr`/`en`/`ar`), y compris le `dir` associé | C |
| 8. Éléments obligatoires | 8.5 Chaque page a-t-elle un titre de page pertinent ? | `<title>Salon RDV</title>` statique actuellement — ne distingue pas Recherche de Connexion | **NC** |
| 8. Éléments obligatoires | 8.9 Éléments utilisés uniquement à des fins de mise en forme ? | Aucun tableau de mise en forme ; `<table>` réservé aux données statistiques (BF-13) | C |
| 9. Structuration | 9.1 Hiérarchie de titres pertinente (un seul `h1`, pas de saut de niveau) ? | Un `h1` unique par écran (`#search-heading`, `#login-heading`) | C |
| 9. Structuration | 9.2 / 12.6 Structure de régions de repérage cohérente ? | `<header>` / `<main>` / `<footer>` présents sur chaque écran — corrigé pendant cet audit (section 1) | C (après correction) |
| 10. Présentation | 10.7 Le focus est-il visible pour tout élément recevant le focus au clavier ? | `outline` `solid` sur 100 % des éléments tracés (section 2.1), jamais supprimé (`:focus-visible` dans `globals.css`) | C |
| 11. Formulaires | 11.1 Chaque champ de formulaire a-t-il une étiquette ? | Tous les champs utilisent `<label htmlFor>` (inscription, connexion, enrôlement MFA, réservation) | C |
| 11. Formulaires | 11.10 Contrôle de saisie sans piège, erreurs annoncées ? | Erreurs affichées via `role="alert" aria-live="assertive"` (`LoginForm.tsx`, `RegisterForm.tsx`) ; message générique volontaire côté connexion (pas de fuite d'information sur l'existence d'un compte) | C |
| 12. Navigation | 12.7 Lien d'évitement / d'accès rapide au contenu ? | Voir section 2.2 | C |
| 12. Navigation | 12.8 Ordre de tabulation cohérent ? | Voir section 2.1 | C |
| 13. Consultation | 13.10 Contenu qui se met à jour sans dérouter (ex. résultats de recherche) ? | Résultats de recherche mis à jour dans une zone `aria-live="polite"` (`SearchClient.tsx`), pas de rechargement silencieux de page | C |

**Légende** : C = conforme, NC = non conforme, NA = non applicable.

### Non-conformité résiduelle identifiée

**8.5 — Titre de page** : le `<title>` est actuellement statique (« Salon RDV ») sur l'ensemble du site
(`src/app/[locale]/layout.tsx`, export `metadata`). Un utilisateur de lecteur d'écran naviguant par onglets
ne peut pas distinguer l'écran de recherche de l'écran de connexion depuis la liste des onglets ou l'historique.
**Non corrigée dans cette itération** — contrairement à l'anomalie de la section 1, celle-ci demande un titre
dynamique par route (`generateMetadata` par page, avec les libellés déjà présents dans
`src/messages/*.json`), un chantier plus large que le correctif ponctuel déjà appliqué. Consignée ici plutôt
que corrigée en silence, conformément à la démarche « heuristiques et compromis » du projet.

---

## 4. Synthèse

- **0 violation automatisée résiduelle** sur les deux écrans clés, dans les trois langues testées (FR, AR
  pour la bascule RTL), après correction d'une anomalie réelle de structuration trouvée pendant l'audit.
- **1 non-conformité résiduelle documentée** (titres de page dynamiques, RGAA 8.5) — corrections proposées
  ci-dessus, non appliquées pour rester dans le périmètre d'un audit *partiel*.
- Les critères clavier (piège, ordre, visibilité du focus, lien d'évitement) et de formulaire (étiquettes,
  erreurs annoncées) — ceux qui conditionnent directement la contrainte C3 — sont tous vérifiés conformes,
  avec preuve reproductible (trace clavier, pas seulement une déclaration).
- Cet audit reste **partiel** par construction (2 écrans sur l'ensemble du prototype, sous-ensemble de
  critères RGAA) : il ne remplace pas un audit RGAA complet outillé (ex. accompagné d'un test lecteur
  d'écran réel — NVDA/VoiceOver — mentionné comme risque résiduel dans
  [plan-architecture.md](../plan-architecture.md#6-risques-résiduels)).
