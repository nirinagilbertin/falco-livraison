# Falco Livraison, backend

API REST de la plateforme de livraison et de gestion logistique : Node.js, Express, MySQL (XAMPP).

## Démarrage
1. `npm install`
2. Copier `.env.example` vers `.env` et adapter les valeurs (base, `JWT_SECRET`).
3. Démarrer MySQL dans XAMPP, puis importer `database/falco_livraison.sql`.
4. `npm run seed:admin` crée l'administrateur initial (mot de passe temporaire à changer à la première connexion).
5. `npm run dev` lance l'API sur `http://localhost:3000/api`.

## Architecture
`routes → controllers → services → repositories → base de données`. Les règles métier sont dans `src/services`, le SQL uniquement dans `src/repositories`. La documentation des routes est dans `docs/API.md`.

| Dossier | Rôle |
|---|---|
| `src/config` | Configuration (variables d'environnement, base de données) |
| `src/routes` | Définition des endpoints et branchement des middlewares |
| `src/controllers` | Lecture de la requête, appel du service, envoi de la réponse |
| `src/services` | Logique métier et règles de gestion |
| `src/repositories` | Accès aux données (requêtes SQL) |
| `src/middlewares` | Authentification, rôles, validation, erreurs |
| `src/validators` | Schémas de validation (zod) |
| `src/jobs` | Tâches planifiées (jour commun, expirations, purge GPS) |
| `src/utils` | Utilitaires (AppError, réponses, asyncHandler) |
| `database` | Script SQL du schéma |

## Scripts
| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur avec rechargement automatique |
| `npm start` | Serveur en production |
| `npm run seed:admin` | Crée le premier administrateur |
| `npm run purge` | Purge les anciennes positions GPS et notifications lues |
| `npm run smoke` | Test de bout en bout (voir ci-dessous) |

## Tâches planifiées (dans le processus de l'API)
- Chaque minute : expiration des propositions sans réponse, annulation des demandes non payées dans le délai.
- Toutes les 5 minutes : redistribution des livraisons inachevées au jour commun.
- Chaque nuit à 3 h : purge des anciennes positions GPS et notifications lues.

## Test de bout en bout
API démarrée : `ADMIN_PASSWORD=<mot de passe admin> npm run smoke` (PowerShell : `$env:ADMIN_PASSWORD="..."; npm run smoke`).
Le script crée des données préfixées `TEST` et déroule une livraison complète.
