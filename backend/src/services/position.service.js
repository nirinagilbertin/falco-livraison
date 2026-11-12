const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const profilRepository = require('../repositories/profil.repository');
const positionRepository = require('../repositories/position.repository');
const routingService = require('./routing.service');

const HISTORY_INTERVAL_S = 5; // au plus un point d'historique toutes les 5 secondes par livreur
const OBSOLETE_AFTER_S = 300; // une position de plus de 5 minutes est signalée comme ancienne

const getLivreur = async (user) => {
  const profil = await profilRepository.findByCompte('livreur', user.id_compte);
  if (!profil) throw AppError.forbidden('Réservé aux livreurs');
  return profil;
};

// CU-17 : le livreur partage sa position, même lorsqu'il est libre.
// La dernière position est toujours mise à jour ; l'historique est limité pour contenir son volume.
const share = async (user, { latitude, longitude }) => {
  const livreur = await getLivreur(user);
  const id_livraison = await positionRepository.findCurrentLivraison(livreur.id_livreur);
  const due = await positionRepository.isHistoryDue(livreur.id_livreur, HISTORY_INTERVAL_S);

  await withTransaction(async (conn) => {
    await positionRepository.updateLastPosition(conn, livreur.id_livreur, latitude, longitude);
    // if (due) await positionRepository.insertHistory(conn, livreur.id_livreur, id_livraison, latitude, longitude);
    if (due && id_livraison) await positionRepository.insertHistory(conn, livreur.id_livreur, id_livraison, latitude, longitude);
  });
  return { latitude, longitude, id_livraison, historique_enregistre: due };
};

// Carte de supervision : dernière position de chaque livreur actif
const listLivreurs = async (query) => {
  const rows = await positionRepository.listLivreurs(query);
  return rows.map((r) => ({
    ...r,
    ancienne: r.age_secondes !== null && r.age_secondes > OBSOLETE_AFTER_S,
  }));
};

// CU-15 : position du livreur. L'expéditeur la voit uniquement pendant la livraison (statut « en_cours »).
const livraisonPosition = async (user, id_livraison) => {
  const row = await positionRepository.findLivraisonTracking(id_livraison);
  if (!row) throw AppError.notFound('Livraison introuvable');

  const isSender = user.role === 'expediteur';
  if (isSender && row.expediteur_id_compte !== user.id_compte) throw AppError.forbidden('Accès refusé à cette livraison');

  const base = { id_livraison: row.id_livraison, numero_suivi: row.numero_suivi, statut: row.statut };
  if (isSender && row.statut !== 'en_cours') {
    return { ...base, position: null, raison: 'La position est disponible uniquement pendant la livraison' };
  }
  if (!row.id_livreur) return { ...base, position: null, raison: 'Aucun livreur affecté' };
  if (row.latitude === null || row.longitude === null) return { ...base, position: null, raison: 'Position du livreur inconnue' };

  const position = {
    latitude: row.latitude,
    longitude: row.longitude,
    date_position: row.date_position,
    age_secondes: row.age_secondes,
    ancienne: row.age_secondes > OBSOLETE_AFTER_S,
  };
  // L'expéditeur ne reçoit pas l'identité du livreur
  return isSender ? { ...base, position } : { ...base, livreur: { id_livreur: row.id_livreur, prenom: row.prenom, nom: row.nom }, position };
};

// Suivi géographique : trajet enregistré d'une livraison (personnel)
const trajet = async (id_livraison, limit) => {
  const row = await positionRepository.findLivraisonTracking(id_livraison);
  if (!row) throw AppError.notFound('Livraison introuvable');
  const points = await positionRepository.findTrack(id_livraison, limit);
  return { id_livraison, numero_suivi: row.numero_suivi, nombre_points: points.length, points };
};

// Itinéraire à suivre : vers la récupération (livraison « affectee ») ou vers le destinataire (« en_cours »)
const itineraire = async (user, id_livraison) => {
  const row = await positionRepository.findItineraryInfo(id_livraison);
  if (!row) throw AppError.notFound('Livraison introuvable');
  if (!row.id_livreur) throw AppError.conflict('Aucun livreur affecté à cette livraison');

  if (user.role === 'livreur') {
    const livreur = await getLivreur(user);
    if (livreur.id_livreur !== row.id_livreur) throw AppError.forbidden('Cette livraison ne vous est pas affectée');
  }

  const pickup = { latitude: row.latitude_recuperation, longitude: row.longitude_recuperation };
  const position =
    row.derniere_latitude !== null && row.derniere_longitude !== null
      ? { latitude: row.derniere_latitude, longitude: row.derniere_longitude }
      : null;

  let etape;
  let arrivee;
  let depart;

  if (row.statut === 'affectee') {
    etape = 'recuperation';
    // Reprise au dépôt lors de la redistribution : on se rend au dépôt, pas chez l'expéditeur
    arrivee =
      row.type_recuperation === 'depot' && row.depot_latitude !== null
        ? { latitude: row.depot_latitude, longitude: row.depot_longitude, adresse: `Dépôt ${row.depot_nom}` }
        : { ...pickup, adresse: row.adresse_recuperation };
    if (!position) throw AppError.conflict('Position du livreur inconnue : partagez votre position pour calculer l\'itinéraire');
    depart = { ...position, source: 'position_livreur' };
  } else if (row.statut === 'en_cours') {
    etape = 'livraison';
    arrivee = { latitude: row.latitude_livraison, longitude: row.longitude_livraison, adresse: row.adresse_livraison };
    depart = position ? { ...position, source: 'position_livreur' } : { ...pickup, source: 'adresse_recuperation' };
  } else {
    throw AppError.conflict(`Aucun itinéraire à suivre pour une livraison « ${row.statut} »`);
  }

  const route = await routingService.getRoute(depart, arrivee);
  return { id_livraison, etape, depart, arrivee, ...route };
};

module.exports = { share, listLivreurs, livraisonPosition, trajet, itineraire };