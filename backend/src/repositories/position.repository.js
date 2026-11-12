const { executor } = require('../config/db');

const AGE = 'TIMESTAMPDIFF(SECOND, lv.date_derniere_position, NOW())';

// Livraison en cours de traitement par le livreur (mission acceptée, pas encore terminée)
const findCurrentLivraison = async (id_livreur) => {
  const rows = await executor()(
    `SELECT li.id_livraison FROM affectation a
     JOIN livraison li ON li.id_livraison = a.id_livraison
     WHERE a.id_livreur = :id_livreur AND a.statut = 'acceptee' AND li.statut IN ('affectee', 'en_cours', 'inachevee')
     ORDER BY a.id_affectation DESC LIMIT 1`,
    { id_livreur }
  );
  return rows[0] ? rows[0].id_livraison : null;
};

// Vrai si la dernière position date de plus de N secondes : limite le volume de l'historique
const isHistoryDue = async (id_livreur, minSeconds) => {
  const rows = await executor()(
    `SELECT (date_derniere_position IS NULL
             OR date_derniere_position < DATE_SUB(NOW(), INTERVAL ${Math.trunc(Number(minSeconds)) || 5} SECOND)) AS due
     FROM livreur WHERE id_livreur = :id_livreur`,
    { id_livreur }
  );
  return Boolean(rows[0] && rows[0].due);
};

const updateLastPosition = (conn, id_livreur, latitude, longitude) =>
  executor(conn)(
    `UPDATE livreur SET derniere_latitude = :latitude, derniere_longitude = :longitude, date_derniere_position = NOW()
     WHERE id_livreur = :id_livreur`,
    { id_livreur, latitude, longitude }
  );

const insertHistory = (conn, id_livreur, id_livraison, latitude, longitude) =>
  executor(conn)(
    'INSERT INTO position_gps (id_livreur, id_livraison, latitude, longitude) VALUES (:id_livreur, :id_livraison, :latitude, :longitude)',
    { id_livreur, id_livraison, latitude, longitude }
  );

// Dernières positions de tous les livreurs actifs (carte de supervision)
const listLivreurs = ({ disponibilite, avec_position }) => {
  const clauses = ["c.statut = 'actif'"];
  const params = {};
  if (disponibilite) { clauses.push('lv.disponibilite = :disponibilite'); params.disponibilite = disponibilite; }
  if (avec_position) clauses.push('lv.date_derniere_position IS NOT NULL');
  return executor()(
    `SELECT lv.id_livreur, lv.prenom, lv.nom, lv.telephone, lv.disponibilite,
            lv.derniere_latitude AS latitude, lv.derniere_longitude AS longitude,
            lv.date_derniere_position AS date_position, ${AGE} AS age_secondes,
            (SELECT d.numero_suivi FROM affectation a
               JOIN livraison li ON li.id_livraison = a.id_livraison
               JOIN demande d ON d.id_demande = li.id_demande
               WHERE a.id_livreur = lv.id_livreur AND a.statut = 'acceptee' AND li.statut IN ('affectee', 'en_cours', 'inachevee')
               ORDER BY a.id_affectation DESC LIMIT 1) AS numero_suivi_en_cours
     FROM livreur lv JOIN compte c ON c.id_compte = lv.id_compte
     WHERE ${clauses.join(' AND ')}
     ORDER BY lv.nom, lv.prenom LIMIT 500`,
    params
  );
};

// Livraison + position du livreur affecté (suivi par l'expéditeur ou le personnel)
const findLivraisonTracking = async (id_livraison) => {
  const rows = await executor()(
    `SELECT li.id_livraison, li.statut, d.numero_suivi, e.id_compte AS expediteur_id_compte,
            lv.id_livreur, lv.prenom, lv.nom,
            lv.derniere_latitude AS latitude, lv.derniere_longitude AS longitude,
            lv.date_derniere_position AS date_position, ${AGE} AS age_secondes
     FROM livraison li
     JOIN demande d ON d.id_demande = li.id_demande
     JOIN expediteur e ON e.id_expediteur = d.id_expediteur
     LEFT JOIN affectation a ON a.id_livraison = li.id_livraison AND a.statut = 'acceptee'
     LEFT JOIN livreur lv ON lv.id_livreur = a.id_livreur
     WHERE li.id_livraison = :id_livraison`,
    { id_livraison }
  );
  return rows[0] || null;
};

// Trajet enregistré d'une livraison
const findTrack = (id_livraison, limit) =>
  executor()(
    `SELECT latitude, longitude, date_enregistrement FROM position_gps
     WHERE id_livraison = :id_livraison ORDER BY date_enregistrement, id_position LIMIT ${Math.trunc(Number(limit)) || 1000}`,
    { id_livraison }
  );

// Données nécessaires au calcul de l'itinéraire d'une livraison
const findItineraryInfo = async (id_livraison) => {
  const rows = await executor()(
    `SELECT li.id_livraison, li.statut, a.id_livreur, a.type_recuperation,
            d.adresse_recuperation, d.latitude_recuperation, d.longitude_recuperation,
            d.adresse_livraison, d.latitude_livraison, d.longitude_livraison,
            lv.derniere_latitude, lv.derniere_longitude,
            (SELECT dp.nom FROM colis c JOIN depot dp ON dp.id_depot = c.id_depot
               WHERE c.id_demande = d.id_demande AND c.statut = 'depose' LIMIT 1) AS depot_nom,
            (SELECT dp.latitude FROM colis c JOIN depot dp ON dp.id_depot = c.id_depot
               WHERE c.id_demande = d.id_demande AND c.statut = 'depose' LIMIT 1) AS depot_latitude,
            (SELECT dp.longitude FROM colis c JOIN depot dp ON dp.id_depot = c.id_depot
               WHERE c.id_demande = d.id_demande AND c.statut = 'depose' LIMIT 1) AS depot_longitude
     FROM livraison li
     JOIN demande d ON d.id_demande = li.id_demande
     LEFT JOIN affectation a ON a.id_livraison = li.id_livraison AND a.statut = 'acceptee'
     LEFT JOIN livreur lv ON lv.id_livreur = a.id_livreur
     WHERE li.id_livraison = :id_livraison`,
    { id_livraison }
  );
  return rows[0] || null;
};

module.exports = {
  findCurrentLivraison, isHistoryDue, updateLastPosition, insertHistory,
  listLivreurs, findLivraisonTracking, findTrack, findItineraryInfo,
};