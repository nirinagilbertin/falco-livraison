-- =====================================================================
-- Falco Livraison — schéma relationnel MySQL (v1)
-- Moteur : InnoDB | Jeu de caractères : utf8mb4
-- Prérequis : MySQL 8.0.16+ ou MariaDB 10.2+ (CHECK, colonnes générées)
-- Conventions : snake_case, clés primaires id_<table>, FK en RESTRICT
-- (suppression physique interdite dès qu'il y a de l'historique)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS falco_livraison
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE falco_livraison;

-- ---------------------------------------------------------------------
-- 1. Dépôts et zones
-- ---------------------------------------------------------------------
CREATE TABLE depot (
  id_depot    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nom         VARCHAR(100) NOT NULL,
  adresse     VARCHAR(255) NOT NULL,
  latitude    DECIMAL(9,6) NOT NULL,
  longitude   DECIMAL(9,6) NOT NULL,
  statut      ENUM('actif','inactif') NOT NULL DEFAULT 'actif',
  PRIMARY KEY (id_depot)
) ENGINE=InnoDB;

CREATE TABLE zone (
  id_zone                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_depot               INT UNSIGNED NOT NULL,          -- une zone = un seul dépôt
  nom_zone               VARCHAR(100) NOT NULL,
  description            VARCHAR(255) NULL,
  ville                  VARCHAR(100) NOT NULL,
  limites_geographiques  JSON NULL,                      -- polygone GeoJSON, facultatif
  statut                 ENUM('active','inactive') NOT NULL DEFAULT 'active',
  PRIMARY KEY (id_zone),
  UNIQUE KEY uq_zone_nom_ville (nom_zone, ville),
  CONSTRAINT fk_zone_depot FOREIGN KEY (id_depot) REFERENCES depot (id_depot)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. Comptes et profils
-- ---------------------------------------------------------------------
CREATE TABLE compte (
  id_compte                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email                    VARCHAR(150) NOT NULL,        -- identifiant de connexion
  nom_utilisateur          VARCHAR(50)  NOT NULL,
  mot_de_passe_hash        VARCHAR(255) NOT NULL,        -- bcrypt / argon2, jamais en clair
  role                     ENUM('administrateur','gestionnaire','superviseur','livreur','expediteur') NOT NULL,
  statut                   ENUM('actif','suspendu') NOT NULL DEFAULT 'actif',
  mot_de_passe_temporaire  TINYINT(1) NOT NULL DEFAULT 0, -- 1 = à changer à la 1re connexion
  photo_profil             VARCHAR(255) NULL,
  date_creation            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  derniere_connexion       DATETIME NULL,
  PRIMARY KEY (id_compte),
  UNIQUE KEY uq_compte_email (email),
  UNIQUE KEY uq_compte_nom_utilisateur (nom_utilisateur)
) ENGINE=InnoDB;

CREATE TABLE utilisateur_interne (                       -- administrateur, gestionnaire, superviseur
  id_utilisateur  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_compte       INT UNSIGNED NOT NULL,
  nom             VARCHAR(80) NOT NULL,
  prenom          VARCHAR(80) NOT NULL,
  telephone       VARCHAR(20) NOT NULL,
  PRIMARY KEY (id_utilisateur),
  UNIQUE KEY uq_utilisateur_compte (id_compte),
  CONSTRAINT fk_utilisateur_compte FOREIGN KEY (id_compte) REFERENCES compte (id_compte)
) ENGINE=InnoDB;

CREATE TABLE expediteur (
  id_expediteur    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_compte        INT UNSIGNED NOT NULL,
  type_expediteur  ENUM('client','entreprise','fournisseur','commercant') NOT NULL,
  nom_complet      VARCHAR(150) NOT NULL,                -- nom du client ou raison sociale
  telephone        VARCHAR(20)  NOT NULL,
  adresse          VARCHAR(255) NULL,
  secteur          VARCHAR(100) NULL,                    -- partenaires uniquement
  PRIMARY KEY (id_expediteur),
  UNIQUE KEY uq_expediteur_compte (id_compte),
  CONSTRAINT fk_expediteur_compte FOREIGN KEY (id_compte) REFERENCES compte (id_compte),
  CONSTRAINT ck_expediteur_secteur CHECK (type_expediteur <> 'client' OR secteur IS NULL)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. Ressources logistiques : véhicules, livreurs
-- ---------------------------------------------------------------------
CREATE TABLE vehicule (
  id_vehicule      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_zone          INT UNSIGNED NOT NULL,                -- zone de rattachement habituelle
  immatriculation  VARCHAR(20) NOT NULL,
  marque           VARCHAR(50) NOT NULL,
  modele           VARCHAR(50) NOT NULL,
  type_vehicule    VARCHAR(30) NOT NULL,                 -- moto, voiture, camionnette...
  carburant        ENUM('essence','diesel','electrique','hybride','autre') NOT NULL,
  capacite_poids   DECIMAL(8,2) NOT NULL,                -- kg
  statut           ENUM('disponible','en_service','en_maintenance','hors_service') NOT NULL DEFAULT 'disponible',
  PRIMARY KEY (id_vehicule),
  UNIQUE KEY uq_vehicule_immat (immatriculation),
  CONSTRAINT fk_vehicule_zone FOREIGN KEY (id_zone) REFERENCES zone (id_zone),
  CONSTRAINT ck_vehicule_capacite CHECK (capacite_poids > 0)
) ENGINE=InnoDB;

CREATE TABLE livreur (
  id_livreur               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_compte                INT UNSIGNED NOT NULL,
  nom                      VARCHAR(80) NOT NULL,
  prenom                   VARCHAR(80) NOT NULL,
  telephone                VARCHAR(20) NOT NULL,
  cin                      VARCHAR(20) NOT NULL,
  disponibilite            ENUM('libre','occupe','hors_service') NOT NULL DEFAULT 'libre',
  id_vehicule              INT UNSIGNED NULL,            -- véhicule habituel (assigné par le gestionnaire)
  derniere_latitude        DECIMAL(9,6) NULL,            -- dernière position connue
  derniere_longitude       DECIMAL(9,6) NULL,
  date_derniere_position   DATETIME NULL,
  PRIMARY KEY (id_livreur),
  UNIQUE KEY uq_livreur_compte (id_compte),
  UNIQUE KEY uq_livreur_cin (cin),
  KEY idx_livreur_vehicule (id_vehicule),
  KEY idx_livreur_dispo (disponibilite),
  CONSTRAINT fk_livreur_compte   FOREIGN KEY (id_compte)   REFERENCES compte (id_compte),
  CONSTRAINT fk_livreur_vehicule FOREIGN KEY (id_vehicule) REFERENCES vehicule (id_vehicule)
) ENGINE=InnoDB;

CREATE TABLE livreur_permis (
  id_livreur  INT UNSIGNED NOT NULL,
  categorie   VARCHAR(5) NOT NULL,                       -- A, B, C...
  PRIMARY KEY (id_livreur, categorie),
  CONSTRAINT fk_permis_livreur FOREIGN KEY (id_livreur) REFERENCES livreur (id_livreur)
) ENGINE=InnoDB;

CREATE TABLE livreur_zone (
  id_livreur  INT UNSIGNED NOT NULL,
  id_zone     INT UNSIGNED NOT NULL,
  PRIMARY KEY (id_livreur, id_zone),
  CONSTRAINT fk_lz_livreur FOREIGN KEY (id_livreur) REFERENCES livreur (id_livreur),
  CONSTRAINT fk_lz_zone    FOREIGN KEY (id_zone)    REFERENCES zone (id_zone)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. Configuration : tarif et paramètres
-- ---------------------------------------------------------------------
CREATE TABLE tarif (
  id_tarif        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  frais_base      DECIMAL(12,2) NOT NULL,
  prix_par_km     DECIMAL(12,2) NOT NULL,
  prix_par_kg     DECIMAL(12,2) NOT NULL,
  actif           TINYINT(1) NOT NULL DEFAULT 0,
  date_creation   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_utilisateur  INT UNSIGNED NULL,                     -- admin ayant créé le tarif
  actif_unique    TINYINT GENERATED ALWAYS AS (IF(actif = 1, 1, NULL)) STORED,
  PRIMARY KEY (id_tarif),
  UNIQUE KEY uq_tarif_un_seul_actif (actif_unique),      -- une seule ligne active
  CONSTRAINT fk_tarif_utilisateur FOREIGN KEY (id_utilisateur) REFERENCES utilisateur_interne (id_utilisateur),
  CONSTRAINT ck_tarif_positif CHECK (frais_base >= 0 AND prix_par_km >= 0 AND prix_par_kg >= 0)
) ENGINE=InnoDB;

CREATE TABLE parametre (
  cle                VARCHAR(50)  NOT NULL,
  valeur             VARCHAR(255) NOT NULL,
  description        VARCHAR(255) NULL,
  date_modification  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (cle)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. Demandes, destinataires, colis
-- ---------------------------------------------------------------------
CREATE TABLE demande (
  id_demande             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  numero_suivi           VARCHAR(20) NOT NULL,           -- ex. FAL-2026-000123
  id_expediteur          INT UNSIGNED NOT NULL,
  adresse_recuperation   VARCHAR(255) NOT NULL,
  latitude_recuperation  DECIMAL(9,6) NOT NULL,
  longitude_recuperation DECIMAL(9,6) NOT NULL,
  id_zone_recuperation   INT UNSIGNED NOT NULL,
  adresse_livraison      VARCHAR(255) NOT NULL,
  latitude_livraison     DECIMAL(9,6) NOT NULL,
  longitude_livraison    DECIMAL(9,6) NOT NULL,
  distance_estimee       DECIMAL(8,2) NOT NULL,          -- km
  frais_estimes          DECIMAL(12,2) NOT NULL,         -- calculés à la création (poids estimatif)
  frais_definitifs       DECIMAL(12,2) NULL,             -- recalculés après vérification (poids réel)
  statut                 ENUM('en_attente','en_cours','verifiee','validee','annulee') NOT NULL DEFAULT 'en_attente',
  date_creation          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_verification      DATETIME NULL,
  date_validation        DATETIME NULL,
  date_annulation        DATETIME NULL,
  motif_annulation       VARCHAR(255) NULL,
  PRIMARY KEY (id_demande),
  UNIQUE KEY uq_demande_numero_suivi (numero_suivi),
  KEY idx_demande_expediteur_statut (id_expediteur, statut),
  CONSTRAINT fk_demande_expediteur FOREIGN KEY (id_expediteur) REFERENCES expediteur (id_expediteur),
  CONSTRAINT fk_demande_zone       FOREIGN KEY (id_zone_recuperation) REFERENCES zone (id_zone),
  CONSTRAINT ck_demande_montants   CHECK (distance_estimee >= 0 AND frais_estimes >= 0
                                          AND (frais_definitifs IS NULL OR frais_definitifs >= 0))
) ENGINE=InnoDB;

CREATE TABLE destinataire (                              -- personnes de vérification de la demande
  id_destinataire  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_demande       INT UNSIGNED NOT NULL,
  nom              VARCHAR(80) NOT NULL,
  prenom           VARCHAR(80) NULL,
  telephone        VARCHAR(20) NOT NULL,
  est_principal    TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id_destinataire),
  KEY idx_destinataire_demande (id_demande),
  CONSTRAINT fk_destinataire_demande FOREIGN KEY (id_demande) REFERENCES demande (id_demande)
) ENGINE=InnoDB;

CREATE TABLE colis (
  id_colis          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_demande        INT UNSIGNED NOT NULL,
  libelle           VARCHAR(100) NOT NULL,
  description       TEXT NULL,
  emballage         VARCHAR(100) NULL,
  poids_estime      DECIMAL(8,2) NOT NULL,               -- kg
  poids_reel        DECIMAL(8,2) NULL,                   -- saisi par le livreur à la vérification
  longueur          DECIMAL(8,2) NULL,                   -- cm (corrigeables par le livreur)
  largeur           DECIMAL(8,2) NULL,
  hauteur           DECIMAL(8,2) NULL,
  instructions      TEXT NULL,
  statut            ENUM('a_recuperer','recupere','livre','depose') NOT NULL DEFAULT 'a_recuperer',
  id_depot          INT UNSIGNED NULL,                   -- renseigné quand le colis est déposé
  date_depot        DATETIME NULL,
  id_utilisateur_depot INT UNSIGNED NULL,                -- gestionnaire ayant confirmé le dépôt
  PRIMARY KEY (id_colis),
  KEY idx_colis_demande (id_demande),
  CONSTRAINT fk_colis_demande FOREIGN KEY (id_demande) REFERENCES demande (id_demande),
  CONSTRAINT fk_colis_depot   FOREIGN KEY (id_depot)   REFERENCES depot (id_depot),
  CONSTRAINT fk_colis_depot_utilisateur FOREIGN KEY (id_utilisateur_depot) REFERENCES utilisateur_interne (id_utilisateur),
  CONSTRAINT ck_colis_poids CHECK (poids_estime > 0 AND (poids_reel IS NULL OR poids_reel > 0))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. Livraisons, affectations, suivi
-- ---------------------------------------------------------------------
CREATE TABLE livraison (
  id_livraison               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_demande                 INT UNSIGNED NOT NULL,      -- 1 demande = 1 livraison
  statut                     ENUM('en_attente','affectee','en_cours','terminee','inachevee','annulee') NOT NULL DEFAULT 'en_attente',
  date_creation              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_affectation           DATETIME NULL,
  date_debut                 DATETIME NULL,
  date_fin                   DATETIME NULL,
  motif_inachevement         VARCHAR(255) NULL,
  date_reprogrammation       DATE NULL,                  -- prochain « jour commun »
  id_destinataire_recepteur  INT UNSIGNED NULL,          -- personne ayant reçu le colis
  methode_verification       ENUM('cin','telephone') NULL,
  PRIMARY KEY (id_livraison),
  UNIQUE KEY uq_livraison_demande (id_demande),
  KEY idx_livraison_statut (statut),
  CONSTRAINT fk_livraison_demande      FOREIGN KEY (id_demande) REFERENCES demande (id_demande),
  CONSTRAINT fk_livraison_destinataire FOREIGN KEY (id_destinataire_recepteur) REFERENCES destinataire (id_destinataire)
) ENGINE=InnoDB;

CREATE TABLE affectation (                               -- propositions successives de mission
  id_affectation          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_livraison            INT UNSIGNED NOT NULL,
  id_livreur              INT UNSIGNED NOT NULL,
  id_vehicule             INT UNSIGNED NOT NULL,         -- copie figée du véhicule du livreur
  id_utilisateur_proposant INT UNSIGNED NULL,            -- NULL = proposition automatique du système
  type_recuperation       ENUM('expediteur','depot') NOT NULL DEFAULT 'expediteur', -- 'depot' = reprise d'une inachevée
  date_proposition        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  statut                  ENUM('en_attente','acceptee','refusee','expiree','annulee') NOT NULL DEFAULT 'en_attente',
  date_reponse            DATETIME NULL,
  acceptee_unique         INT UNSIGNED GENERATED ALWAYS AS (IF(statut = 'acceptee', id_livraison, NULL)) STORED,
  PRIMARY KEY (id_affectation),
  UNIQUE KEY uq_affectation_une_acceptee (acceptee_unique), -- une seule affectation acceptée / livraison
  KEY idx_affectation_livraison_statut (id_livraison, statut),
  KEY idx_affectation_livreur (id_livreur),
  CONSTRAINT fk_affectation_livraison FOREIGN KEY (id_livraison) REFERENCES livraison (id_livraison),
  CONSTRAINT fk_affectation_livreur   FOREIGN KEY (id_livreur)   REFERENCES livreur (id_livreur),
  CONSTRAINT fk_affectation_vehicule  FOREIGN KEY (id_vehicule)  REFERENCES vehicule (id_vehicule),
  CONSTRAINT fk_affectation_proposant FOREIGN KEY (id_utilisateur_proposant) REFERENCES utilisateur_interne (id_utilisateur)
) ENGINE=InnoDB;

CREATE TABLE position_gps (                              -- forte volumétrie : prévoir une purge
  id_position        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_livreur         INT UNSIGNED NOT NULL,
  id_livraison       INT UNSIGNED NULL,                  -- NULL si le livreur est « libre »
  latitude           DECIMAL(9,6) NOT NULL,
  longitude          DECIMAL(9,6) NOT NULL,
  date_enregistrement DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_position),
  KEY idx_position_livreur_date (id_livreur, date_enregistrement),
  KEY idx_position_livraison_date (id_livraison, date_enregistrement),
  CONSTRAINT fk_position_livreur   FOREIGN KEY (id_livreur)   REFERENCES livreur (id_livreur),
  CONSTRAINT fk_position_livraison FOREIGN KEY (id_livraison) REFERENCES livraison (id_livraison)
) ENGINE=InnoDB;

CREATE TABLE historique_statut_livraison (
  id_historique    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_livraison     INT UNSIGNED NOT NULL,
  ancien_statut    ENUM('en_attente','affectee','en_cours','terminee','inachevee','annulee') NULL,
  nouveau_statut   ENUM('en_attente','affectee','en_cours','terminee','inachevee','annulee') NOT NULL,
  id_compte        INT UNSIGNED NULL,                    -- auteur ; NULL = système
  motif            VARCHAR(255) NULL,
  date_changement  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_historique),
  KEY idx_historique_livraison (id_livraison, date_changement),
  CONSTRAINT fk_historique_livraison FOREIGN KEY (id_livraison) REFERENCES livraison (id_livraison),
  CONSTRAINT fk_historique_compte    FOREIGN KEY (id_compte)    REFERENCES compte (id_compte)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. Paiements (simulés)
-- ---------------------------------------------------------------------
CREATE TABLE paiement (
  id_paiement              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_demande               INT UNSIGNED NOT NULL,
  montant                  DECIMAL(12,2) NOT NULL,
  mode_paiement            ENUM('carte','mobile_money') NOT NULL,
  statut                   ENUM('en_cours','valide','echoue','annule') NOT NULL DEFAULT 'en_cours',
  -- Données masquées uniquement : jamais de numéro de carte complet ni de CVV
  carte_derniers_chiffres  CHAR(4) NULL,
  titulaire_carte          VARCHAR(100) NULL,
  operateur_mobile         VARCHAR(50) NULL,
  numero_payeur            VARCHAR(20) NULL,
  reference_paiement       VARCHAR(40) NOT NULL,
  numero_recu              VARCHAR(40) NULL,             -- renseigné si le paiement est validé
  motif_echec              VARCHAR(255) NULL,            -- ex. « numéro de carte invalide »
  date_creation            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_paiement            DATETIME NULL,
  valide_unique            INT UNSIGNED GENERATED ALWAYS AS (IF(statut = 'valide', id_demande, NULL)) STORED,
  PRIMARY KEY (id_paiement),
  UNIQUE KEY uq_paiement_reference (reference_paiement),
  UNIQUE KEY uq_paiement_recu (numero_recu),
  UNIQUE KEY uq_paiement_un_seul_valide (valide_unique), -- un seul paiement validé / demande
  KEY idx_paiement_demande (id_demande),
  CONSTRAINT fk_paiement_demande FOREIGN KEY (id_demande) REFERENCES demande (id_demande),
  CONSTRAINT ck_paiement_montant CHECK (montant > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. Notifications, incidents, alertes, audit
-- ---------------------------------------------------------------------
CREATE TABLE notification (
  id_notification  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_compte        INT UNSIGNED NOT NULL,
  type             VARCHAR(50) NOT NULL,                 -- mission_proposee, changement_statut, alerte...
  libelle          VARCHAR(255) NOT NULL,
  id_livraison     INT UNSIGNED NULL,
  statut           ENUM('non_lue','lue') NOT NULL DEFAULT 'non_lue',
  date_creation    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_lecture     DATETIME NULL,
  PRIMARY KEY (id_notification),
  KEY idx_notification_compte_statut (id_compte, statut),
  CONSTRAINT fk_notification_compte    FOREIGN KEY (id_compte)    REFERENCES compte (id_compte),
  CONSTRAINT fk_notification_livraison FOREIGN KEY (id_livraison) REFERENCES livraison (id_livraison)
) ENGINE=InnoDB;

CREATE TABLE incident (
  id_incident      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_livraison     INT UNSIGNED NOT NULL,                -- toujours rattaché à une livraison
  id_declarant     INT UNSIGNED NOT NULL,                -- compte du livreur ou de l'expéditeur
  type_incident    VARCHAR(50) NOT NULL,
  description      TEXT NOT NULL,
  statut           ENUM('nouveau','en_cours','resolu') NOT NULL DEFAULT 'nouveau',
  id_responsable   INT UNSIGNED NULL,                    -- gestionnaire en charge
  date_creation    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_resolution  DATETIME NULL,
  PRIMARY KEY (id_incident),
  KEY idx_incident_livraison (id_livraison),
  KEY idx_incident_statut (statut),
  CONSTRAINT fk_incident_livraison   FOREIGN KEY (id_livraison)   REFERENCES livraison (id_livraison),
  CONSTRAINT fk_incident_declarant   FOREIGN KEY (id_declarant)   REFERENCES compte (id_compte),
  CONSTRAINT fk_incident_responsable FOREIGN KEY (id_responsable) REFERENCES utilisateur_interne (id_utilisateur)
) ENGINE=InnoDB;

CREATE TABLE alerte (
  id_alerte        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_livraison     INT UNSIGNED NULL,
  id_incident      INT UNSIGNED NULL,                    -- si l'alerte vient d'un incident
  type_alerte      ENUM('retard','refus_mission','absence_reponse','aucun_livreur',
                        'livraison_inachevee','incident','autre') NOT NULL,
  libelle          VARCHAR(255) NOT NULL,
  niveau_priorite  ENUM('faible','moyen','eleve') NOT NULL DEFAULT 'moyen',
  statut           ENUM('nouvelle','en_cours','resolue') NOT NULL DEFAULT 'nouvelle',
  id_responsable   INT UNSIGNED NULL,
  date_creation    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_resolution  DATETIME NULL,
  PRIMARY KEY (id_alerte),
  KEY idx_alerte_statut_priorite (statut, niveau_priorite),
  KEY idx_alerte_livraison (id_livraison),
  CONSTRAINT fk_alerte_livraison   FOREIGN KEY (id_livraison)   REFERENCES livraison (id_livraison),
  CONSTRAINT fk_alerte_incident    FOREIGN KEY (id_incident)    REFERENCES incident (id_incident),
  CONSTRAINT fk_alerte_responsable FOREIGN KEY (id_responsable) REFERENCES utilisateur_interne (id_utilisateur)
) ENGINE=InnoDB;

CREATE TABLE journal_audit (                             -- traçabilité minimale : qui, quoi, quand
  id_journal   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_compte    INT UNSIGNED NULL,                        -- NULL = système
  action       VARCHAR(50) NOT NULL,
  type_objet   VARCHAR(50) NOT NULL,
  id_objet     BIGINT UNSIGNED NULL,
  details      VARCHAR(255) NULL,
  date_action  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_journal),
  KEY idx_audit_compte_date (id_compte, date_action),
  KEY idx_audit_objet (type_objet, id_objet),
  CONSTRAINT fk_audit_compte FOREIGN KEY (id_compte) REFERENCES compte (id_compte)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Paramètres initiaux (valeurs à ajuster)
-- ---------------------------------------------------------------------
INSERT INTO parametre (cle, valeur, description) VALUES
  ('jour_livraison_commune', '6',  'Jour de la semaine (1=lundi ... 7=dimanche) de redistribution des livraisons inachevées'),
  ('delai_reponse_livreur_min', '15', 'Minutes sans réponse avant expiration d''une proposition de mission'),
  ('delai_paiement_min', '30', 'Minutes laissées à l''expéditeur pour payer après vérification du colis, avant annulation');

-- =====================================================================
-- Règles NON garanties par le schéma (à gérer dans l'API ou par triggers)
--  1. compte.role cohérent avec la table de profil liée.
--  2. Un seul destinataire principal par demande.
--  3. Éligibilité d'un livreur : compte actif, disponibilite = 'libre', véhicule
--     assigné et non « en_service » pour un autre livreur, zone compatible.
--  4. Somme des poids des colis <= vehicule.capacite_poids.
--  5. Transitions de statut valides (demande, livraison, affectation).
--  6. paiement.montant = demande.frais_definitifs au moment du paiement.
--  7. livraison.id_destinataire_recepteur appartient à la même demande.
--  8. Le gestionnaire ne crée que des comptes « livreur » ; jamais de demande
--     pour le compte d'un expéditeur.
--  9. Suppression d'un compte : seulement sans historique, sinon statut = 'suspendu'.
-- 10. Jour commun : les livraisons inachevées repassent « en_attente » ; leur colis
--     (colis.statut = 'depose') est repris au dépôt (affectation.type_recuperation = 'depot'),
--     sans calcul de proximité, par les livreurs libres des zones rattachées à ce dépôt,
--     jusqu'à épuisement des colis du dépôt.
-- =====================================================================
