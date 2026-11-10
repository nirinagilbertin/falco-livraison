const { executor } = require('../config/db');

const create = async (conn, { id_livraison = null, type_alerte, libelle, niveau_priorite = 'moyen' }) => {
  const result = await executor(conn)(
    `INSERT INTO alerte (id_livraison, type_alerte, libelle, niveau_priorite)
     VALUES (:id_livraison, :type_alerte, :libelle, :niveau_priorite)`,
    { id_livraison, type_alerte, libelle: String(libelle).slice(0, 255), niveau_priorite }
  );
  return result.insertId;
};

// Une alerte du même type non résolue existe-t-elle déjà pour cette livraison ?
const existsOpen = async (conn, id_livraison, type_alerte) =>
  (await executor(conn)(
    "SELECT 1 FROM alerte WHERE id_livraison = :id_livraison AND type_alerte = :type_alerte AND statut <> 'resolue' LIMIT 1",
    { id_livraison, type_alerte }
  )).length > 0;

const findByLivraison = (id_livraison) =>
  executor()(
    `SELECT id_alerte, type_alerte, libelle, niveau_priorite, statut, date_creation, date_resolution
     FROM alerte WHERE id_livraison = :id_livraison ORDER BY date_creation DESC, id_alerte DESC`,
    { id_livraison }
  );

module.exports = { create, existsOpen, findByLivraison };