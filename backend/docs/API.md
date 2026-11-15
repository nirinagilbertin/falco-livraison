# API Falco Livraison

Base : `http://localhost:3000/api`. Les routes protégées demandent l'en-tête `Authorization: Bearer <jeton>`.

## Conventions
- **Succès** : `{ "success": true, "message"?, "data", "meta"? }`.
- **Listes** : `?page=1&limit=20` (100 maximum) ; `meta` contient `page`, `limit`, `total`, `totalPages`.
- **Erreur** : `{ "success": false, "error": { "code", "message", "details"? } }`.
- **Codes courants** : 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED` ou `TOKEN_EXPIRED`, 403 `FORBIDDEN`, `ACCOUNT_SUSPENDED` ou `PASSWORD_CHANGE_REQUIRED`, 404 `NOT_FOUND`, 409 conflit métier, 429 trop de tentatives.
- **Champs** : mêmes noms que les colonnes de la base (`snake_case`). Dates au format ISO.
- **Mot de passe temporaire** : tant qu'il n'est pas changé, seules `/auth/me` et `/auth/change-password` répondent.
- **Rôles** : `administrateur`, `gestionnaire`, `superviseur`, `livreur`, `expediteur` (client ou partenaire commercial).

## Santé et authentification
| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/health`, `/health/db` | public | État du serveur et de la base |
| POST | `/auth/register` | public | Inscription d'un expéditeur |
| POST | `/auth/login` | public | Connexion par e-mail |
| POST | `/auth/refresh` | connecté | Renouvelle le jeton |
| GET | `/auth/me` | connecté | Compte et profil |
| POST | `/auth/change-password` | connecté | Change le mot de passe |
| PATCH | `/profil` | connecté | Modifie son profil (champs selon le rôle) |

## Comptes et ressources
| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET, POST | `/utilisateurs` | administrateur | Liste, création (gestionnaire, superviseur) |
| GET, DELETE | `/utilisateurs/:id` | administrateur | Détail, suppression (sans historique) |
| PATCH | `/utilisateurs/:id/role` | administrateur | Gestionnaire ↔ superviseur |
| POST | `/utilisateurs/:id/suspendre`, `/reactiver` | administrateur | Suspension, réactivation |
| GET, POST | `/livreurs` | administrateur, gestionnaire | Liste, création |
| GET, PATCH, DELETE | `/livreurs/:id` | administrateur, gestionnaire | Détail, modification, suppression ou désactivation |
| GET, POST | `/vehicules`, `/zones`, `/depots` | lecture : administrateur, gestionnaire ; écriture : voir ci-dessous | Liste, création |
| GET, PATCH, DELETE | `/vehicules/:id` | administrateur, gestionnaire | Détail, modification, suppression ou désactivation |
| GET, PATCH, DELETE | `/zones/:id`, `/depots/:id` | lecture : administrateur, gestionnaire ; écriture : administrateur | Idem |

Écriture des zones et dépôts : administrateur. Écriture des véhicules : administrateur et gestionnaire.

## Configuration
| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/tarifs/actif`, `/tarifs/simuler?distance=&poids=` | connecté | Tarif actif, estimation des frais |
| GET, POST | `/tarifs` | administrateur | Liste, création (`"activer": true` pour l'activer) |
| GET | `/tarifs/:id` | administrateur | Détail |
| POST | `/tarifs/:id/activer` | administrateur | Active un tarif (désactive l'ancien) |
| GET | `/parametres` | administrateur, gestionnaire | Jour commun, délais |
| PATCH | `/parametres/:cle` | administrateur ; gestionnaire pour `jour_livraison_commune` | `{"valeur": 6}` |

## Demandes et paiements
| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| POST | `/demandes` | expéditeur | Crée une demande (colis, adresses avec coordonnées, destinataires) |
| GET | `/demandes`, `/demandes/:id` | expéditeur (les siennes), administrateur, gestionnaire, superviseur | Consultation |
| POST | `/demandes/:id/annuler` | expéditeur | Annule tant que non validée |
| POST | `/demandes/:id/paiements` | expéditeur | Paiement simulé : 201 validé, 402 échoué |
| GET | `/demandes/:id/paiements` | expéditeur, administrateur | Tentatives et date limite |

Paiement par carte : `{"mode_paiement":"carte","numero_carte":"4111 1111 1111 1111","titulaire":"Jean Rakoto","expiration":"12/2035","cryptogramme":"123"}`. Par mobile money : `{"mode_paiement":"mobile_money","operateur":"mvola","numero":"0341234567"}`. Cartes de test : finissant par `0002` refusée, par `9995` fonds insuffisants.

## Livraisons et missions
| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/livraisons`, `/livraisons/:id` | administrateur, gestionnaire, superviseur | Suivi (filtres `statut`, `q`, `sans_livreur`) |
| GET | `/livraisons/:id/livreurs-eligibles` | administrateur, gestionnaire | Livreurs éligibles, du plus proche au plus éloigné |
| POST | `/livraisons/:id/affecter` | administrateur, gestionnaire | `{"id_livreur": 3}` |
| POST | `/livraisons/:id/relancer-recherche` | administrateur, gestionnaire | Relance la recherche automatique |
| POST | `/livraisons/:id/affecter-depot` | administrateur, gestionnaire | Impose un livreur pour une reprise au dépôt |
| POST | `/livraisons/redistribution/lancer` | administrateur, gestionnaire | Lance la redistribution tout de suite |
| GET | `/affectations` | livreur | Ses propositions et missions (`?statut=`) |
| GET | `/affectations/:id` | livreur propriétaire, administrateur, gestionnaire, superviseur | Détail |
| POST | `/affectations/:id/accepter`, `/refuser` | livreur | Réponse à une mission |
| POST | `/affectations/:id/annuler` | administrateur, gestionnaire | Annule une proposition en attente |

## Exécution d'une livraison
| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| POST | `/livraisons/:id/verifier` | livreur affecté | `{"colis":[{"id_colis":1,"poids_reel":3.2}]}` : frais définitifs |
| POST | `/livraisons/:id/recuperer` | livreur affecté | Après paiement validé |
| POST | `/livraisons/:id/livrer` | livreur affecté | `{"id_destinataire":1,"methode_verification":"cin"}` |
| POST | `/livraisons/:id/echec` | livreur affecté | `{"motif_type":"destinataire_absent","detail":"..."}` |
| POST | `/livraisons/:id/confirmer-depot` | administrateur, gestionnaire | Colis déposé, livreur libéré |

## Géolocalisation
| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| POST | `/positions` | livreur | `{"latitude":-21.45,"longitude":47.08}` |
| GET | `/positions` | administrateur, gestionnaire, superviseur | Dernières positions des livreurs |
| GET | `/livraisons/:id/position` | expéditeur (pendant `en_cours`), personnel | Position du livreur |
| GET | `/livraisons/:id/trajet` | personnel | Trajet enregistré |
| GET | `/livraisons/:id/itineraire` | livreur affecté, personnel | Distance, durée, tracé GeoJSON |

## Incidents, alertes, notifications
| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| POST | `/incidents` | livreur, expéditeur | `{"id_livraison":1,"type_incident":"colis_endommage","description":"..."}` |
| GET | `/incidents`, `/incidents/:id` | personnel (tout), livreur et expéditeur (les leurs) | Consultation |
| POST | `/incidents/:id/prendre-en-charge`, `/resoudre` | administrateur, gestionnaire | Traitement |
| GET | `/alertes`, `/alertes/:id` | administrateur, gestionnaire, superviseur | Consultation |
| POST | `/alertes/:id/prendre-en-charge`, `/resoudre` | administrateur, gestionnaire | Traitement |
| GET | `/notifications` | connecté | Mes notifications (`meta.non_lues`) |
| POST | `/notifications/:id/lire`, `/notifications/lire-tout` | connecté | Marquer comme lues |

## Statistiques et administration
| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/statistiques/tableau-de-bord`, `/evolution`, `/livreurs` | administrateur, superviseur | Chiffres clés, séries, performance (`?du=&au=`) |
| GET | `/statistiques/moi` | expéditeur, livreur | Statistiques personnelles |
| GET | `/paiements` | administrateur | Paiements (filtres `statut`, `mode_paiement`, `du`, `au`, `q`) |
| GET | `/audit` | administrateur | Journal d'audit |

## Cycles de vie
- **Demande** : `en_attente` → `en_cours` → `verifiee` → `validee` (ou `annulee` avant validation).
- **Livraison** : `en_attente` → `affectee` → `en_cours` → `terminee` ou `inachevee` ; une inachevée repasse `en_attente` au jour commun.
- **Proposition** : `en_attente` → `acceptee`, `refusee`, `expiree` ou `annulee`.
- **Colis** : `a_recuperer` → `recupere` → `livre` ou `depose`.
- **Paiement** : `en_cours` → `valide` ou `echoue`.