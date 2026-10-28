const auditRepository = require('../repositories/audit.repository');

// Consigne une opération importante : qui, quoi, quand.
// Passer `conn` pour l'inscrire dans la même transaction que l'opération.
// id_compte = null signifie que l'auteur est le système.
const log = (entry, conn) =>
  auditRepository.insert(conn, {
    ...entry,
    details: entry.details ? String(entry.details).slice(0, 255) : null,
  });

module.exports = { log };