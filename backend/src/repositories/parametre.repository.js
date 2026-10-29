const { executor } = require('../config/db');

const list = () => executor()('SELECT cle, valeur, description, date_modification FROM parametre');

const findByKey = async (cle) => {
  const rows = await executor()('SELECT cle, valeur, description, date_modification FROM parametre WHERE cle = :cle', { cle });
  return rows[0] || null;
};

// Crée la ligne si elle n'existe pas, sinon met à jour la valeur
const upsert = (conn, { cle, valeur, description }) =>
  executor(conn)(
    `INSERT INTO parametre (cle, valeur, description) VALUES (:cle, :valeur, :description)
     ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`,
    { cle, valeur, description }
  );

module.exports = { list, findByKey, upsert };