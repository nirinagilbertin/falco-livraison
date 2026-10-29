const { executor } = require('../config/db');
const { buildWhere, buildLimit } = require('../utils/sql');

const FROM = 'FROM tarif t LEFT JOIN utilisateur_interne ui ON ui.id_utilisateur = t.id_utilisateur';
const COLUMNS = `t.id_tarif, t.frais_base, t.prix_par_km, t.prix_par_kg, t.actif, t.date_creation,
  t.id_utilisateur, CONCAT(ui.prenom, ' ', ui.nom) AS auteur`;

const normalize = (row) => (row ? { ...row, actif: Boolean(row.actif) } : null);

const list = async ({ actif }, pagination) => {
  const clauses = [];
  const params = {};
  if (actif !== undefined) { clauses.push('t.actif = :actif'); params.actif = actif ? 1 : 0; }
  const where = buildWhere(clauses);
  const run = executor();

  const rows = await run(
    `SELECT ${COLUMNS} ${FROM} ${where} ORDER BY t.date_creation DESC, t.id_tarif DESC ${buildLimit(pagination)}`,
    params
  );
  const [{ total }] = await run(`SELECT COUNT(*) AS total FROM tarif t ${where}`, params);
  return { items: rows.map(normalize), total };
};

const findById = async (id_tarif, conn) => {
  const rows = await executor(conn)(`SELECT ${COLUMNS} ${FROM} WHERE t.id_tarif = :id_tarif`, { id_tarif });
  return normalize(rows[0]);
};

const findActive = async (conn) => {
  const rows = await executor(conn)(`SELECT ${COLUMNS} ${FROM} WHERE t.actif = 1 LIMIT 1`);
  return normalize(rows[0]);
};

// Un tarif est toujours créé inactif ; l'activation est une opération distincte
const create = async (conn, { frais_base, prix_par_km, prix_par_kg, id_utilisateur }) => {
  const result = await executor(conn)(
    `INSERT INTO tarif (frais_base, prix_par_km, prix_par_kg, actif, id_utilisateur)
     VALUES (:frais_base, :prix_par_km, :prix_par_kg, 0, :id_utilisateur)`,
    { frais_base, prix_par_km, prix_par_kg, id_utilisateur }
  );
  return result.insertId;
};

// Le schéma n'autorise qu'un seul tarif actif : on désactive l'ancien avant d'activer le nouveau
const deactivateAll = (conn) => executor(conn)('UPDATE tarif SET actif = 0 WHERE actif = 1');
const activate = (conn, id_tarif) => executor(conn)('UPDATE tarif SET actif = 1 WHERE id_tarif = :id_tarif', { id_tarif });

module.exports = { list, findById, findActive, create, deactivateAll, activate };