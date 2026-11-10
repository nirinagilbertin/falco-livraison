const { executor } = require('../config/db');
const { likeParam, buildWhere, buildLimit } = require('../utils/sql');

const create = async (conn, id_demande) => {
  const result = await executor(conn)('INSERT INTO livraison (id_demande) VALUES (:id_demande)', { id_demande });
  return result.insertId;
};

const findByDemande = async (id_demande, conn) => {
  const rows = await executor(conn)(
    `SELECT id_livraison, id_demande, statut, date_creation, date_affectation, date_debut, date_fin,
            motif_inachevement, date_reprogrammation, methode_verification
     FROM livraison WHERE id_demande = :id_demande`,
    { id_demande }
  );
  return rows[0] || null;
};

const findByIdForUpdate = async (conn, id_livraison) => {
  const rows = await executor(conn)('SELECT id_livraison, id_demande, statut FROM livraison WHERE id_livraison = :id_livraison FOR UPDATE', { id_livraison });
  return rows[0] || null;
};

// Livraison avec sa demande, son expéditeur et le poids total estimé (contexte d'une affectation)
const findContext = async (id_livraison, conn) => {
  const rows = await executor(conn)(
    `SELECT li.id_livraison, li.statut, d.id_demande, d.numero_suivi, d.statut AS statut_demande,
            d.id_zone_recuperation, d.adresse_recuperation, d.latitude_recuperation, d.longitude_recuperation,
            d.adresse_livraison, d.latitude_livraison, d.longitude_livraison, d.distance_estimee,
            e.id_compte AS expediteur_id_compte, e.nom_complet AS expediteur_nom, e.telephone AS expediteur_telephone,
            (SELECT COALESCE(SUM(c.poids_estime), 0) FROM colis c WHERE c.id_demande = d.id_demande) AS poids_total
     FROM livraison li
     JOIN demande d ON d.id_demande = li.id_demande
     JOIN expediteur e ON e.id_expediteur = d.id_expediteur
     WHERE li.id_livraison = :id_livraison`,
    { id_livraison }
  );
  return rows[0] || null;
};

const updateStatut = (conn, id_livraison, statut) =>
  executor(conn)('UPDATE livraison SET statut = :statut WHERE id_livraison = :id_livraison', { id_livraison, statut });

const markAffectee = (conn, id_livraison) =>
  executor(conn)("UPDATE livraison SET statut = 'affectee', date_affectation = NOW() WHERE id_livraison = :id_livraison", { id_livraison });

// R25 : chaque changement de statut est historisé (id_compte null = système)
const insertHistorique = (conn, { id_livraison, ancien_statut = null, nouveau_statut, id_compte = null, motif = null }) =>
  executor(conn)(
    `INSERT INTO historique_statut_livraison (id_livraison, ancien_statut, nouveau_statut, id_compte, motif)
     VALUES (:id_livraison, :ancien_statut, :nouveau_statut, :id_compte, :motif)`,
    { id_livraison, ancien_statut, nouveau_statut, id_compte, motif }
  );

const findHistorique = (id_livraison, conn) =>
  executor(conn)(
    `SELECT ancien_statut, nouveau_statut, id_compte, motif, date_changement
     FROM historique_statut_livraison WHERE id_livraison = :id_livraison ORDER BY date_changement, id_historique`,
    { id_livraison }
  );

// CU-12 : liste des livraisons pour le suivi (livreur affecté, proposition en attente)
const list = async ({ statut, q, sans_livreur }, pagination) => {
  const clauses = [];
  const params = {};
  if (statut) { clauses.push('li.statut = :statut'); params.statut = statut; }
  if (q) {
    clauses.push('(d.numero_suivi LIKE :q OR d.adresse_recuperation LIKE :q OR d.adresse_livraison LIKE :q OR e.nom_complet LIKE :q)');
    params.q = likeParam(q);
  }
  if (sans_livreur) {
    clauses.push(`li.statut = 'en_attente' AND NOT EXISTS (SELECT 1 FROM affectation p WHERE p.id_livraison = li.id_livraison AND p.statut = 'en_attente')`);
  }
  const where = buildWhere(clauses);
  const from = `FROM livraison li
    JOIN demande d ON d.id_demande = li.id_demande
    JOIN expediteur e ON e.id_expediteur = d.id_expediteur`;
  const run = executor();

  const items = await run(
    `SELECT li.id_livraison, li.statut, li.date_creation, d.id_demande, d.numero_suivi, d.statut AS statut_demande,
            d.adresse_recuperation, d.adresse_livraison, d.distance_estimee, e.nom_complet AS expediteur_nom,
            (SELECT CONCAT(lv.prenom, ' ', lv.nom) FROM affectation a JOIN livreur lv ON lv.id_livreur = a.id_livreur
              WHERE a.id_livraison = li.id_livraison AND a.statut = 'acceptee' LIMIT 1) AS livreur_nom,
            (SELECT CONCAT(lv.prenom, ' ', lv.nom) FROM affectation a JOIN livreur lv ON lv.id_livreur = a.id_livreur
              WHERE a.id_livraison = li.id_livraison AND a.statut = 'en_attente' LIMIT 1) AS proposition_livreur_nom
     ${from} ${where} ORDER BY li.date_creation DESC, li.id_livraison DESC ${buildLimit(pagination)}`,
    params
  );
  const [{ total }] = await run(`SELECT COUNT(*) AS total ${from} ${where}`, params);
  return { items, total };
};

module.exports = {
  create, findByDemande, findByIdForUpdate, findContext, updateStatut, markAffectee, insertHistorique, findHistorique, list,
};