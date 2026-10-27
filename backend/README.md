# Falco Livraison — Backend

API REST Node.js / Express / MySQL (XAMPP).

## Démarrage
1. `npm install`
2. Copier `.env.example` vers `.env` et adapter les valeurs
3. `npm run dev` (ou `npm start`)
4. Tester : `GET http://localhost:3000/api/health`

## Architecture en couches
`routes → controllers → services → repositories → base de données`

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
