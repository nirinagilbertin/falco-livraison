const { executor } = require('../config/db');

const create = async (conn, { id_compte, type_expediteur, nom_complet, telephone, adresse = null, secteur = null }) => {
  const result = await executor(conn)(
    `INSERT INTO expediteur (id_compte, type_expediteur, nom_complet, telephone, adresse, secteur)
     VALUES (:id_compte, :type_expediteur, :nom_complet, :telephone, :adresse, :secteur)`,
    { id_compte, type_expediteur, nom_complet, telephone, adresse, secteur }
  );
  return result.insertId;
};

module.exports = { create };