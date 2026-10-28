const { executor } = require('../config/db');
const { likeParam, buildWhere, buildLimit, buildSet } = require('../utils/sql');

const COLUMNS = 'd.id_depot, d.nom, d.adresse, d.latitude, d.longitude, d.statut';
const UPDATABLE = ['nom', 'adresse', 'latitude', 'longitude', 'statut'];

const list = async ({ statut, q }, pagination) => {
  const clauses = [];
  const params = {};
  if (statut) { clauses.push('d.statut = :statut'); params.statut = statut; }
  if (q) { clauses.push('(d.nom LIKE :q OR d.adresse LIKE :q)'); params.q = likeParam(q); }
  const where = buildWhere(clauses);
  const run = executor();

  const items = await run(
    `SELECT ${COLUMNS}, (SELECT COUNT(*) FROM zone z WHERE z.id_depot = d.id_depot) AS nb_zones
     FROM depot d ${where} ORDER BY d.nom ASC ${buildLimit(pagination)}`,
    params
  );
  const [{ total }] = await run(`SELECT COUNT(*) AS total FROM depot d ${where}`, params);
  return { items, total };
};

const findById = async (id_depot, conn) => {
  const rows = await executor(conn)(`SELECT ${COLUMNS} FROM depot d WHERE d.id_depot = :id_depot`, { id_depot });
  return rows[0] || null;
};

const create = async (conn, { nom, adresse, latitude, longitude }) => {
  const result = await executor(conn)(
    'INSERT INTO depot (nom, adresse, latitude, longitude) VALUES (:nom, :adresse, :latitude, :longitude)',
    { nom, adresse, latitude, longitude }
  );
  return result.insertId;
};

const update = async (conn, id_depot, data) => {
  const set = buildSet(data, UPDATABLE);
  if (!set.count) return;
  await executor(conn)(`UPDATE depot SET ${set.sql} WHERE id_depot = :id_depot`, { ...set.params, id_depot });
};

const remove = (conn, id_depot) => executor(conn)('DELETE FROM depot WHERE id_depot = :id_depot', { id_depot });

module.exports = { list, findById, create, update, remove };