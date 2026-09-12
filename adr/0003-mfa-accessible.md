# ADR-003 : WebAuthn/TOTP plutôt qu'une solution MFA générique

**Statut** : Proposé
**Date** : 2026-07-15
**Contraintes concernées** : C3 (sécurité forte + accessibilité clavier)
**Tension liée** : T3 — voir [plan-architecture.md](../plan-architecture.md#t3)

## Contexte

Le brief exige à la fois une authentification forte (MFA) et une utilisabilité entière au clavier pour les
personnes malvoyantes. La majorité des solutions MFA du marché reposent sur un scan de QR code au smartphone
ou un CAPTCHA visuel, tous deux inutilisables au clavier seul avec un lecteur d'écran.

## Options envisagées

| Option | Avantages | Inconvénients |
|---|---|---|
| **A. Solution MFA SaaS clé en main** | Rapide à intégrer | Rarement auditée pour l'accessibilité clavier ; risque de blocage total pour un utilisateur malvoyant si le widget dépend de la souris ou d'un CAPTCHA visuel |
| **B. WebAuthn (passkeys) en principal + TOTP saisi manuellement en repli, SMS en dernier recours** | WebAuthn nativement navigable au clavier et compatible lecteurs d'écran (spécification W3C) ; TOTP ne dépend d'aucune perception visuelle ; couvre sécurité forte et accessibilité sans solution dégradée | Développement et tests manuels (lecteur d'écran) plus longs qu'une intégration de widget existant ; support navigateur/appareil à vérifier pour WebAuthn |
| **C. SMS OTP uniquement** | Perçu comme simple par le grand public | Niveau de sécurité MFA le plus faible (SIM swapping) ; dépend de la réception SMS, en tension avec C4 (zones à faible couverture) |

## Décision

Option **B**. WebAuthn/passkeys est la méthode MFA principale ; TOTP saisi manuellement sert de repli pour les
appareils non compatibles ; le SMS n'est conservé qu'en tout dernier recours. Aucun mécanisme reposant
uniquement sur la souris ou la perception visuelle n'est utilisé dans le parcours d'authentification. Le
parcours complet (inscription du facteur, connexion, erreurs) est validé au clavier (Tab/Entrée), avec focus
visible et messages d'erreur portés par une zone ARIA live.

## Conséquences

**Positives**
- Conformité simultanée à l'exigence de sécurité (MFA fort) et d'accessibilité (RGAA), sans repli dégradé
  pour l'un ou l'autre.
- Réduit la dépendance à un fournisseur SMS tiers, ce qui bénéficie aussi à C4 (réseau dégradé).

**Négatives (compromis assumé)**
- Effort de développement et de test manuel (lecteur d'écran) supérieur à une intégration MFA standard.
- WebAuthn est moins connu du grand public que le SMS : un effort de pédagogie / documentation utilisateur
  est nécessaire.

## Révision

Si l'audit RGAA partiel (phase 4 du plan de réalisation) révèle un point de friction clavier non anticipé dans
le flux WebAuthn, réévaluer l'ordre de priorité des méthodes ou les patrons d'interaction du formulaire de
connexion.

## État d'implémentation (prototype livrable 5)

TOTP saisi manuellement est le mécanisme MFA effectivement construit et testé (accessible au clavier,
erreurs en zone ARIA live, clé secrète affichée en repli du QR code — voir `accessibilite/rapport-rgaa.md`).
**WebAuthn/passkey et le repli SMS n'ont pas été implémentés dans ce prototype** : ils restent la cible
documentée par cette ADR pour une itération ultérieure (aucune dépendance WebAuthn dans
`prototype/package.json`). TOTP seul satisfait l'exigence C3 (MFA + clavier), mais sans le gain de
résistance au phishing propre à WebAuthn — compromis à assumer explicitement tant que WebAuthn n'est pas
construit.
