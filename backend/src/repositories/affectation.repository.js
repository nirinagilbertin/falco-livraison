const { executor } = require('../config/db');

// Propositions encore ouvertes pour une livraison (en attente de réponse ou acceptées)
const findOpenByLivraison = (conn, id_livraison) =>
  executor(conn)(
    `SELECT id_affectation, id_livreur, id_vehicule, statut FROM affectation
     WHERE id_livraison = :id_livraison AND statut IN ('en_attente', 'acceptee') FOR UPDATE`,
    { id_livraison }
  );

const cancelOpen = (conn, id_livraison) =>
  executor(conn)(
    `UPDATE affectation SET statut = 'annulee', date_reponse = COALESCE(date_reponse, NOW())
     WHERE id_livraison = :id_livraison AND statut IN ('en_attente', 'acceptee')`,
    { id_livraison }
  );

// Libère le livreur et son véhicule (annulation, fin de livraison...)
const releaseLivreurAndVehicule = async (conn, { id_livreur, id_vehicule }) => {
  const run = executor(conn);
  await run("UPDATE livreur SET disponibilite = 'libre' WHERE id_livreur = :id_livreur AND disponibilite = 'occupe'", { id_livreur });
  await run("UPDATE vehicule SET statut = 'disponible' WHERE id_vehicule = :id_vehicule AND statut = 'en_service'", { id_vehicule });
};

module.exports = { findOpenByLivraison, cancelOpen, releaseLivreurAndVehicule };