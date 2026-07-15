# Prototype — Salon RDV

Prototype fonctionnel du livrable 5 (`architecture-logicielle-projet_1.md` §« Livrable »), packagé et
lançable via `docker-compose`, sans installation manuelle. Il illustre l'IHM accessible et les heuristiques
T1–T7 documentées dans [../plan-architecture.md](../plan-architecture.md) sur un socle réel : Next.js
(monolithe modulaire), PostgreSQL, Redis, Mailhog.

## Lancer le prototype

Depuis la racine du repository (pas ce dossier) :

```bash
docker compose up
```

- Application : http://localhost:3001 (redirige automatiquement vers `/fr`)
- Notifications simulées (Mailhog) : http://localhost:8025
- Premier démarrage : la base est vide, donc automatiquement initialisée (schéma + jeu de données de
  démo). Les démarrages suivants réutilisent les données existantes (le seed ne s'exécute que si la base
  est vide).
- Port hôte 3001 choisi pour éviter un conflit avec d'éventuels autres projets locaux utilisant le port 3000
  (l'application écoute sur le port 3000 à l'intérieur du conteneur).

Pour repartir d'un état propre : `docker compose down -v` puis `docker compose up`.

## Comptes de démonstration

Mot de passe pour tous : `Demo1234!`. Secret TOTP partagé (à ajouter dans une app d'authentification comme
Google Authenticator, Aegis, ou à générer avec `otplib`) : `JBSWY3DPEHPK3PXP`.

| Email | Rôle | Contexte |
|---|---|---|
| `client@example.com` | Client | A déjà un RDV confirmé et un RDV en attente de validation |
| `coiffeur1@example.com` | Coiffeur | Julie Martin, Salon Étoile — Lyon (coupe, coloration, brushing) |
| `coiffeur2@example.com` | Coiffeur | Karim Haddad, Salon Waha — Marseille (coupe, coloration), parle arabe |
| `coiffeur3@example.com` | Coiffeur | Emma Clarke, Salon Lumière — Paris (coupe, brushing), anglophone |
| `gestion@example.com` | Gestion | Accès au tableau de bord statistique agrégé (BF-13) |

Vous pouvez aussi créer un nouveau compte via « Créer un compte » pour tester l'enrôlement MFA de bout en
bout (BF-01) plutôt que la connexion à un compte déjà enrôlé (BF-02).

## Parcours à tester

- **Recherche → réservation → espace client** (BF-03, BF-04, BF-08) : rechercher un coiffeur, réserver un
  créneau, consulter le résultat dans « Mon espace ».
- **Authentification accessible au clavier** (BF-01, BF-02, T3) : parcourir le formulaire de connexion et
  l'enrôlement MFA uniquement au clavier (Tab / Entrée) ; le focus doit rester visible à chaque étape et les
  erreurs sont portées par une zone `aria-live`.
- **Mode dégradé** (BF-04, ADR-004) : couper le réseau (mode hors-ligne des outils de développement du
  navigateur, ou débrancher le Wi-Fi), réserver un créneau → l'IHM affiche « en attente de synchronisation »
  au lieu d'un message d'erreur ; reconnecter le réseau → la demande se synchronise automatiquement (ou via
  le bouton « Synchroniser maintenant » dans « Mon espace »).
- **Bascule RTL** (BF-11, ADR-005) : changer la langue vers العربية via le sélecteur en haut de page — le
  sens de lecture change instantanément (`dir="rtl"`), sans gabarit dédié.
- **Back-office coiffeur** (BF-09, BF-10) : ajouter/retirer un créneau, valider ou refuser une demande
  entrante.
- **Statistiques agrégées** (BF-13, ADR-006) : se connecter avec `gestion@example.com` — seuls les
  regroupements de 5 rendez-vous ou plus apparaissent (seuil de k-anonymat).
- **Notifications** (BF-07) : après une réservation ou une décision du coiffeur, l'email envoyé est visible
  dans Mailhog (http://localhost:8025), aucune vraie clé SMS/email n'est nécessaire.
- **Assistance accessible** (BF-12) : page « Assistance », entièrement clavier, réponses annoncées via une
  zone `role="log"`.

## Fidélité volontairement « mesurée » (décisions assumées pour ce prototype)

- **MFA** : TOTP est le mécanisme réellement câblé (fonctionnel de bout en bout). WebAuthn/passkey reste la
  cible principale documentée par [ADR-003](../adr/0003-mfa-accessible.md), mais son intégration dépend
  d'une interaction plateforme (Touch ID, clé de sécurité...) impossible à démontrer de façon fiable dans un
  conteneur — hors périmètre de cette itération.
- **Mode hors-ligne** : cache de lecture réel via Service Worker (recherche, pages déjà visitées) + file
  d'écriture côté client rejouée manuellement au retour réseau (`public/service-worker.js`,
  `src/lib/offlineQueue.ts`). L'API Background Sync n'est pas utilisée : son support navigateur reste trop
  inégal (essentiellement Chromium) pour une démonstration fiable — voir
  [ADR-004](../adr/0004-pwa-offline-first.md).
- **Notifications** : Mailhog tient lieu de fournisseur SMS/Email tiers. Le reste de l'application ne connaît
  que `src/lib/notify.ts` (interface interne) — remplacer Mailhog par un vrai fournisseur ne touche que ce
  module (ADR-002, ADR-007).

## Structure

```
prisma/schema.prisma   Schéma de données (utilisateurs, salons, créneaux, rendez-vous)
prisma/seed.ts         Jeu de données de démonstration
src/app/[locale]/...   Pages (App Router), une route par écran
src/app/api/...        Points d'API (auth, recherche, réservations, back-office, créneaux)
src/components/        Composants clients (formulaires, listes interactives)
src/lib/                db, redis, session, totp, mailer, notify, i18n, offlineQueue
public/service-worker.js, public/manifest.json   PWA
```

`prisma db push` est utilisé plutôt qu'un historique de migrations formel : suffisant pour un prototype
pédagogique sans données de production à faire évoluer (T7 — pas une brique de plus à maintenir).
