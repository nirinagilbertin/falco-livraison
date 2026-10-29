const { executor } = require('../config/db');
const { likeParam, buildWhere, buildLimit, buildSet } = require('../utils/sql');

// disponibilite n'est modifiable que par le code interne (désactivation), jamais par l'API
const UPDATABLE = ['nom', 'prenom', 'telephone', 'cin', 'id_vehicule', 'disponibilite'];

const splitPermis = (value) => (value ? value.split(',') : []);

const list = async ({ disponibilite, statut, id_zone, q }, pagination) => {
  const clauses = [];
  const params = {};
  if (disponibilite) { clauses.push('l.disponibilite = :disponibilite'); params.disponibilite = disponibilite; }
  if (statut) { clauses.push('c.statut = :statut'); params.statut = statut; }
  if (id_zone) {
    clauses.push('EXISTS (SELECT 1 FROM livreur_zone lz WHERE lz.id_livreur = l.id_livreur AND lz.id_zone = :id_zone)');
    params.id_zone = id_zone;
  }
  if (q) {
    clauses.push('(l.nom LIKE :q OR l.prenom LIKE :q OR l.telephone LIKE :q OR l.cin LIKE :q OR c.email LIKE :q)');
    params.q = likeParam(q);
  }
  const where = buildWhere(clauses);
  const from = 'FROM livreur l JOIN compte c ON c.id_compte = l.id_compte LEFT JOIN vehicule v ON v.id_vehicule = l.id_vehicule';
  const run = executor();

  const rows = await run(
    `SELECT l.id_livreur, l.id_compte, c.email, c.statut AS statut_compte, l.nom, l.prenom, l.telephone, l.cin,
            l.disponibilite, l.id_vehicule, v.immatriculation,
            (SELECT GROUP_CONCAT(categorie ORDER BY categorie) FROM livreur_permis p WHERE p.id_livreur = l.id_livreur) AS permis,
            (SELECT COUNT(*) FROM livreur_zone z WHERE z.id_livreur = l.id_livreur) AS nb_zones
     ${from} ${where} ORDER BY l.nom ASC, l.prenom ASC ${buildLimit(pagination)}`,
    params
  );
  const [{ total }] = await run(`SELECT COUNT(*) AS total ${from} ${where}`, params);
  return { items: rows.map((r) => ({ ...r, permis: splitPermis(r.permis) })), total };
};

const findById = async (id_livreur, conn) => {
  const rows = await executor(conn)(
    `SELECT l.id_livreur, l.id_compte, c.email, c.nom_utilisateur, c.statut AS statut_compte,
            c.mot_de_passe_temporaire, c.derniere_connexion,
            l.nom, l.prenom, l.telephone, l.cin, l.disponibilite,
            l.derniere_latitude, l.derniere_longitude, l.date_derniere_position,
            l.id_vehicule, v.immatriculation, v.marque, v.modele, v.type_vehicule, v.capacite_poids,
            v.statut AS vehicule_statut
     FROM livreur l JOIN compte c ON c.id_compte = l.id_compte
     LEFT JOIN vehicule v ON v.id_vehicule = l.id_vehicule
     WHERE l.id_livreur = :id_livreur`,
    { id_livreur }
  );
  return rows[0] || null;
};

const findByCin = async (cin, excludeId = 0) => {
  const rows = await executor()('SELECT id_livreur FROM livreur WHERE cin = :cin AND id_livreur <> :excludeId LIMIT 1', { cin, excludeId });
  return rows[0] || null;
};

const findPermis = async (id_livreur) => {
  const rows = await executor()('SELECT categorie FROM livreur_permis WHERE id_livreur = :id_livreur ORDER BY categorie', { id_livreur });
  return rows.map((r) => r.categorie);
};

const findZones = (id_livreur) =>
  executor()(
    `SELECT z.id_zone, z.nom_zone, z.ville, z.statut
     FROM livreur_zone lz JOIN zone z ON z.id_zone = lz.id_zone
     WHERE lz.id_livreur = :id_livreur ORDER BY z.ville, z.nom_zone`,
    { id_livreur }
  );

// Zones demandées (id, statut) : sert à vérifier qu'elles existent et sont actives
const findZonesByIds = (ids) => {
  const params = Object.fromEntries(ids.map((id, i) => [`z${i}`, id]));
  const placeholders = ids.map((_, i) => `:z${i}`).join(', ');
  return executor()(`SELECT id_zone, statut FROM zone WHERE id_zone IN (${placeholders})`, params);
};

const create = async (conn, { id_compte, nom, prenom, telephone, cin, id_vehicule = null }) => {
  const result = await executor(conn)(
    `INSERT INTO livreur (id_compte, nom, prenom, telephone, cin, id_vehicule)
     VALUES (:id_compte, :nom, :prenom, :telephone, :cin, :id_vehicule)`,
    { id_compte, nom, prenom, telephone, cin, id_vehicule }
  );
  return result.insertId;
};

const update = async (conn, id_livreur, data) => {
  const set = buildSet(data, UPDATABLE);
  if (!set.count) return;
  await executor(conn)(`UPDATE livreur SET ${set.sql} WHERE id_livreur = :id_livreur`, { ...set.params, id_livreur });
};

const replacePermis = async (conn, id_livreur, categories) => {
  const run = executor(conn);
  await run('DELETE FROM livreur_permis WHERE id_livreur = :id_livreur', { id_livreur });
  for (const categorie of categories) {
    await run('INSERT INTO livreur_permis (id_livreur, categorie) VALUES (:id_livreur, :categorie)', { id_livreur, categorie });
  }
};

const replaceZones = async (conn, id_livreur, zoneIds) => {
  const run = executor(conn);
  await run('DELETE FROM livreur_zone WHERE id_livreur = :id_livreur', { id_livreur });
  for (const id_zone of zoneIds) {
    await run('INSERT INTO livreur_zone (id_livreur, id_zone) VALUES (:id_livreur, :id_zone)', { id_livreur, id_zone });
  }
};

module.exports = { list, findById, findByCin, findPermis, findZones, findZonesByIds, create, update, replacePermis, replaceZones };