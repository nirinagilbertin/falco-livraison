const { executor } = require('../config/db');

const insert = (conn, { id_compte = null, action, type_objet, id_objet = null, details = null }) =>
  executor(conn)(
    `INSERT INTO journal_audit (id_compte, action, type_objet, id_objet, details)
     VALUES (:id_compte, :action, :type_objet, :id_objet, :details)`,
    { id_compte, action, type_objet, id_objet, details }
  );

module.exports = { insert };