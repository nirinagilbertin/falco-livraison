const { executor } = require('../config/db');
const { likeParam, buildWhere, buildLimit, buildSet } = require('../utils/sql');

const UPDATABLE = ['id_depot', 'nom_zone', 'ville', 'description', 'limites_geographiques', 'statut'];

const LIST_COLUMNS = `z.id_zone, z.id_depot, d.nom AS depot_nom, z.nom_zone, z.ville, z.description, z.statut`;

// MariaDB renvoie la colonne JSON sous forme de texte, MySQL sous forme d'objet : on normalise
const normalize = (row) => {
  if (row && typeof row.limites_geographiques === 'string') {
    try { row.limites_geographiques = JSON.parse(row.limites_geographiques); } catch { /* laissé tel quel */ }
  }
  return row;
};

const list = async ({ statut, id_depot, ville, q }, pagination) => {
  const clauses = [];
  const params = {};
  if (statut) { clauses.push('z.statut = :statut'); params.statut = statut; }
  if (id_depot) { clauses.push('z.id_depot = :id_depot'); params.id_depot = id_depot; }
  if (ville) { clauses.push('z.ville = :ville'); params.ville = ville; }
  if (q) { clauses.push('(z.nom_zone LIKE :q OR z.ville LIKE :q)'); params.q = likeParam(q); }
  const where = buildWhere(clauses);
  const run = executor();

  const items = await run(
    `SELECT ${LIST_COLUMNS} FROM zone z JOIN depot d ON d.id_depot = z.id_depot
     ${where} ORDER BY z.ville ASC, z.nom_zone ASC ${buildLimit(pagination)}`,
    params
  );
  const [{ total }] = await run(`SELECT COUNT(*) AS total FROM zone z ${where}`, params);
  return { items, total };
};

const findById = async (id_zone, conn) => {
  const rows = await executor(conn)(
    `SELECT ${LIST_COLUMNS}, z.limites_geographiques,
            (SELECT COUNT(*) FROM livreur_zone lz WHERE lz.id_zone = z.id_zone) AS nb_livreurs,
            (SELECT COUNT(*) FROM vehicule v WHERE v.id_zone = z.id_zone) AS nb_vehicules
     FROM zone z JOIN depot d ON d.id_depot = z.id_depot WHERE z.id_zone = :id_zone`,
    { id_zone }
  );
  return normalize(rows[0]) || null;
};

// Zone portant le même nom dans la même ville (unicité du schéma), en excluant éventuellement une zone
const findByNameAndCity = async (nom_zone, ville, excludeId = 0) => {
  const rows = await executor()(
    'SELECT id_zone FROM zone WHERE nom_zone = :nom_zone AND ville = :ville AND id_zone <> :excludeId LIMIT 1',
    { nom_zone, ville, excludeId }
  );
  return rows[0] || null;
};

const countActiveByDepot = async (id_depot) => {
  const [{ total }] = await executor()(
    "SELECT COUNT(*) AS total FROM zone WHERE id_depot = :id_depot AND statut = 'active'",
    { id_depot }
  );
  return total;
};

// Zones actives dotées de limites géographiques : sert à localiser une adresse
const findActiveWithBoundaries = async () => {
  const rows = await executor()(
    `SELECT id_zone, nom_zone, ville, limites_geographiques FROM zone
     WHERE statut = 'active' AND limites_geographiques IS NOT NULL ORDER BY id_zone`
  );
  return rows.map(normalize);
};

const toJson = (v) => (v ? JSON.stringify(v) : null);

const create = async (conn, { id_depot, nom_zone, ville, description, limites_geographiques }) => {
  const result = await executor(conn)(
    `INSERT INTO zone (id_depot, nom_zone, ville, description, limites_geographiques)
     VALUES (:id_depot, :nom_zone, :ville, :description, :limites_geographiques)`,
    { id_depot, nom_zone, ville, description: description ?? null, limites_geographiques: toJson(limites_geographiques) }
  );
  return result.insertId;
};

const update = async (conn, id_zone, data) => {
  const payload = { ...data };
  if (payload.limites_geographiques !== undefined) payload.limites_geographiques = toJson(payload.limites_geographiques);
  const set = buildSet(payload, UPDATABLE);
  if (!set.count) return;
  await executor(conn)(`UPDATE zone SET ${set.sql} WHERE id_zone = :id_zone`, { ...set.params, id_zone });
};

const remove = (conn, id_zone) => executor(conn)('DELETE FROM zone WHERE id_zone = :id_zone', { id_zone });

module.exports = { list, findById, findByNameAndCity, findActiveWithBoundaries, countActiveByDepot, create, update, remove };