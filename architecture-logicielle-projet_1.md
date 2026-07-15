## Objectif du projet

Concevoir l’architecture logicielle d’une **plateforme web de prise de rendez-vous en salon de coiffure**, destinée au grand public, intégrant **accessibilité numérique**, **performance**, **expérience utilisateur** et **adaptabilité aux besoins métier**.
Le projet répond à un **besoin d'une chaîne régionale de salons de coiffure** visant à réduire les files d'attente et à améliorer l'accès aux coiffeurs, y compris pour les personnes en situation de handicap.

---

## **Besoins Fonctionnels**

1. **Création de compte** pour clients et professionnels du salon (coiffeurs).
2. **Recherche de coiffeur** par prestation (coupe, coloration, brushing…), localisation, langue parlée.
3. **Prise de rendez-vous** via agenda synchronisé.
4. **Notification par email ou SMS** des rappels de rendez-vous.
5. **Annulation ou report de rendez-vous.**
6. **Espace client** pour gérer ses rendez-vous passés/futurs.
7. **Espace professionnel** pour gérer ses créneaux, valider ou refuser un rendez-vous.
8. **Support multilingue**.
9. **Assistance accessible en ligne** (chatbot + support visuel/audio).

---


## **Contraintes à intégrer**

**1. Contraintes de déploiement**

> *"La solution doit pouvoir être hébergée à la fois sur des serveurs mutualisés peu coûteux et migrée plus tard vers le cloud (AWS ou Azure) sans refonte majeure."*

**2. Contrainte de performance sous charge**

> *"Le système doit supporter 500 utilisateurs simultanés lors de pics (ex : ouverture des créneaux avant les fêtes de fin d'année), tout en garantissant un temps de réponse < 2s."*

**3. Contrainte de sécurité et d’accessibilité combinée**

> *"La plateforme doit implémenter l’authentification forte (MFA) tout en restant entièrement utilisable au clavier pour les personnes malvoyantes."*

**4. Contrainte de qualité dégradée**

> *"La plateforme doit rester fonctionnelle en cas de coupure réseau ou de faible bande passante (notamment en zone rurale)."*

**5. Contrainte de localisation**

> *"L’interface doit être traduite en 3 langues : français, anglais, arabe, avec adaptation du sens de lecture."*


**6. Contrainte d’analyse métier**

> *"Les données des rendez-vous doivent pouvoir être agrégées à des fins statistiques sans exposer d’informations personnelles."*


**7. Contraintes de maintenance**

> *"L’architecture doit permettre à une petite équipe (3 personnes) de maintenir l’application avec un minimum de dépendances techniques."*


--- 

## **Livrable**


**1. Dossier d’architecture logicielle (principal livrable)**

- Expression des besoins (fonctionnels et non fonctionnels)
- Parcours utilisateur (détaillé avec contraintes)
- Choix d’architecture (avec heuristiques et compromis)
- Diagrammes (composants, déploiement, use case, C4 , etc.)
- Justification de la solution face aux besoins métier

**2. Rapport d’analyse de performance**

* Analyse de scénarios critiques (pics de charge, latence, I/O)
* Recommandations d’optimisation (ex. : cache, découplage, CDN)

**3. Rapport d’accessibilité RGAA 4**
- Simuler un audit partiel RGAA pour une page/écran clé.  

**4. Présentation de soutenance**

**5. Maquette ou prototype fonctionnel** :  
* Prototype visuel de l’IHM accessible, packagé et lançable via `docker-compose up` (aucune installation manuelle requise).  
* Fournit un `docker-compose.yml` démarrant l’ensemble des services nécessaires à la démonstration (front, back éventuel, base de données de test).  
* Jeu de données de démonstration préchargé pour illustrer les parcours utilisateur clés (recherche de coiffeur, prise de rendez-vous, espace client).  
