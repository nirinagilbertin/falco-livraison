const { executor } = require('../config/db');

const create = async (conn, id_demande) => {
  const result = await executor(conn)('INSERT INTO livraison (id_demande) VALUES (:id_demande)', { id_demande });
  return result.insertId;
};

const findByDemande = async (id_demande, conn) => {
  const rows = await executor(conn)(
    `SELECT id_livraison, id_demande, statut, date_creation, date_affectation, date_debut, date_fin,
            motif_inachevement, date_reprogrammation, methode_verification
     FROM livraison WHERE id_demande = :id_demande`,
    { id_demande }
  );
  return rows[0] || null;
};

const updateStatut = (conn, id_livraison, statut) =>
  executor(conn)('UPDATE livraison SET statut = :statut WHERE id_livraison = :id_livraison', { id_livraison, statut });

// R25 : chaque changement de statut est historisé (id_compte null = système)
const insertHistorique = (conn, { id_livraison, ancien_statut = null, nouveau_statut, id_compte = null, motif = null }) =>
  executor(conn)(
    `INSERT INTO historique_statut_livraison (id_livraison, ancien_statut, nouveau_statut, id_compte, motif)
     VALUES (:id_livraison, :ancien_statut, :nouveau_statut, :id_compte, :motif)`,
    { id_livraison, ancien_statut, nouveau_statut, id_compte, motif }
  );

const findHistorique = (id_livraison, conn) =>
  executor(conn)(
    `SELECT ancien_statut, nouveau_statut, id_compte, motif, date_changement
     FROM historique_statut_livraison WHERE id_livraison = :id_livraison ORDER BY date_changement, id_historique`,
    { id_livraison }
  );

module.exports = { create, findByDemande, updateStatut, insertHistorique, findHistorique };