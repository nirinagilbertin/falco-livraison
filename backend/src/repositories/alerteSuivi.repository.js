const { executor } = require('../config/db');
const { buildWhere, buildLimit } = require('../utils/sql');

const SELECT = `SELECT a.id_alerte, a.id_livraison, d.numero_suivi, a.id_incident, a.type_alerte, a.libelle,
  a.niveau_priorite, a.statut, a.id_responsable, CONCAT(ui.prenom, ' ', ui.nom) AS responsable,
  a.date_creation, a.date_resolution
  FROM alerte a
  LEFT JOIN livraison li ON li.id_livraison = a.id_livraison
  LEFT JOIN demande d ON d.id_demande = li.id_demande
  LEFT JOIN utilisateur_interne ui ON ui.id_utilisateur = a.id_responsable`;

// Les plus urgentes d'abord (non résolues, puis priorité, puis les plus récentes)
const list = async ({ statut, niveau_priorite, type_alerte, id_livraison }, pagination) => {
  const clauses = [];
  const params = {};
  if (statut) { clauses.push('a.statut = :statut'); params.statut = statut; }
  if (niveau_priorite) { clauses.push('a.niveau_priorite = :niveau_priorite'); params.niveau_priorite = niveau_priorite; }
  if (type_alerte) { clauses.push('a.type_alerte = :type_alerte'); params.type_alerte = type_alerte; }
  if (id_livraison) { clauses.push('a.id_livraison = :id_livraison'); params.id_livraison = id_livraison; }
  const where = buildWhere(clauses);
  const run = executor();

  const items = await run(
    `${SELECT} ${where}
     ORDER BY (a.statut = 'resolue'), FIELD(a.niveau_priorite, 'eleve', 'moyen', 'faible'), a.date_creation DESC, a.id_alerte DESC
     ${buildLimit(pagination)}`,
    params
  );
  const [{ total }] = await run(`SELECT COUNT(*) AS total FROM alerte a ${where}`, params);
  return { items, total };
};

const findById = async (id_alerte, conn) => {
  const rows = await executor(conn)(`${SELECT} WHERE a.id_alerte = :id_alerte`, { id_alerte });
  return rows[0] || null;
};

const lockById = async (conn, id_alerte) => {
  const rows = await executor(conn)('SELECT id_alerte, statut FROM alerte WHERE id_alerte = :id_alerte FOR UPDATE', { id_alerte });
  return rows[0] || null;
};

const takeOver = (conn, id_alerte, id_responsable) =>
  executor(conn)("UPDATE alerte SET statut = 'en_cours', id_responsable = :id_responsable WHERE id_alerte = :id_alerte", { id_alerte, id_responsable });

const resolve = (conn, id_alerte) =>
  executor(conn)("UPDATE alerte SET statut = 'resolue', date_resolution = NOW() WHERE id_alerte = :id_alerte", { id_alerte });

module.exports = { list, findById, lockById, takeOver, resolve };