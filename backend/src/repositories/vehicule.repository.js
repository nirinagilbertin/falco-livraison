const { executor } = require('../config/db');
const { likeParam, buildWhere, buildLimit, buildSet } = require('../utils/sql');

const COLUMNS = `v.id_vehicule, v.id_zone, z.nom_zone, v.immatriculation, v.marque, v.modele,
  v.type_vehicule, v.carburant, v.capacite_poids, v.statut`;
const UPDATABLE = ['id_zone', 'immatriculation', 'marque', 'modele', 'type_vehicule', 'carburant', 'capacite_poids', 'statut'];

const list = async ({ statut, id_zone, type_vehicule, q }, pagination) => {
  const clauses = [];
  const params = {};
  if (statut) { clauses.push('v.statut = :statut'); params.statut = statut; }
  if (id_zone) { clauses.push('v.id_zone = :id_zone'); params.id_zone = id_zone; }
  if (type_vehicule) { clauses.push('v.type_vehicule = :type_vehicule'); params.type_vehicule = type_vehicule; }
  if (q) { clauses.push('(v.immatriculation LIKE :q OR v.marque LIKE :q OR v.modele LIKE :q)'); params.q = likeParam(q); }
  const where = buildWhere(clauses);
  const run = executor();

  const items = await run(
    `SELECT ${COLUMNS}, (SELECT COUNT(*) FROM livreur l WHERE l.id_vehicule = v.id_vehicule) AS nb_livreurs
     FROM vehicule v JOIN zone z ON z.id_zone = v.id_zone
     ${where} ORDER BY v.immatriculation ASC ${buildLimit(pagination)}`,
    params
  );
  const [{ total }] = await run(`SELECT COUNT(*) AS total FROM vehicule v ${where}`, params);
  return { items, total };
};

const findById = async (id_vehicule, conn) => {
  const rows = await executor(conn)(
    `SELECT ${COLUMNS} FROM vehicule v JOIN zone z ON z.id_zone = v.id_zone WHERE v.id_vehicule = :id_vehicule`,
    { id_vehicule }
  );
  return rows[0] || null;
};

const findByImmatriculation = async (immatriculation, excludeId = 0) => {
  const rows = await executor()(
    'SELECT id_vehicule FROM vehicule WHERE immatriculation = :immatriculation AND id_vehicule <> :excludeId LIMIT 1',
    { immatriculation, excludeId }
  );
  return rows[0] || null;
};

// Livreurs dont c'est le véhicule habituel
const findLivreurs = (id_vehicule) =>
  executor()('SELECT id_livreur, nom, prenom FROM livreur WHERE id_vehicule = :id_vehicule ORDER BY nom, prenom', { id_vehicule });

const create = async (conn, d) => {
  const result = await executor(conn)(
    `INSERT INTO vehicule (id_zone, immatriculation, marque, modele, type_vehicule, carburant, capacite_poids, statut)
     VALUES (:id_zone, :immatriculation, :marque, :modele, :type_vehicule, :carburant, :capacite_poids, :statut)`,
    {
      id_zone: d.id_zone, immatriculation: d.immatriculation, marque: d.marque, modele: d.modele,
      type_vehicule: d.type_vehicule, carburant: d.carburant, capacite_poids: d.capacite_poids,
      statut: d.statut ?? 'disponible',
    }
  );
  return result.insertId;
};

const update = async (conn, id_vehicule, data) => {
  const set = buildSet(data, UPDATABLE);
  if (!set.count) return;
  await executor(conn)(`UPDATE vehicule SET ${set.sql} WHERE id_vehicule = :id_vehicule`, { ...set.params, id_vehicule });
};

const remove = (conn, id_vehicule) => executor(conn)('DELETE FROM vehicule WHERE id_vehicule = :id_vehicule', { id_vehicule });

module.exports = { list, findById, findByImmatriculation, findLivreurs, create, update, remove };