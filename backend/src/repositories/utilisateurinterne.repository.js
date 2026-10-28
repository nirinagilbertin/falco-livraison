const { executor } = require('../config/db');

const create = async (conn, { id_compte, nom, prenom, telephone }) => {
  const result = await executor(conn)(
    `INSERT INTO utilisateur_interne (id_compte, nom, prenom, telephone)
     VALUES (:id_compte, :nom, :prenom, :telephone)`,
    { id_compte, nom, prenom, telephone }
  );
  return result.insertId;
};

module.exports = { create };