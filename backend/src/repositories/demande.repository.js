const { executor } = require('../config/db');
const { likeParam, buildWhere, buildLimit } = require('../utils/sql');

const list = async ({ statut, id_expediteur, du, au, q }, pagination) => {
  const clauses = [];
  const params = {};
  if (statut) { clauses.push('d.statut = :statut'); params.statut = statut; }
  if (id_expediteur) { clauses.push('d.id_expediteur = :id_expediteur'); params.id_expediteur = id_expediteur; }
  if (du) { clauses.push('d.date_creation >= :du'); params.du = du; }
  if (au) { clauses.push('d.date_creation < DATE_ADD(:au, INTERVAL 1 DAY)'); params.au = au; }
  if (q) {
    clauses.push('(d.numero_suivi LIKE :q OR d.adresse_recuperation LIKE :q OR d.adresse_livraison LIKE :q OR e.nom_complet LIKE :q)');
    params.q = likeParam(q);
  }
  const where = buildWhere(clauses);
  const from = `FROM demande d
    JOIN expediteur e ON e.id_expediteur = d.id_expediteur
    JOIN livraison l ON l.id_demande = d.id_demande`;
  const run = executor();

  const items = await run(
    `SELECT d.id_demande, d.numero_suivi, d.statut, d.adresse_recuperation, d.adresse_livraison,
            d.distance_estimee, d.frais_estimes, d.frais_definitifs, d.date_creation,
            e.id_expediteur, e.nom_complet AS expediteur_nom, e.type_expediteur,
            l.id_livraison, l.statut AS statut_livraison,
            (SELECT COUNT(*) FROM colis c WHERE c.id_demande = d.id_demande) AS nb_colis
     ${from} ${where} ORDER BY d.date_creation DESC, d.id_demande DESC ${buildLimit(pagination)}`,
    params
  );
  const [{ total }] = await run(`SELECT COUNT(*) AS total ${from} ${where}`, params);
  return { items, total };
};

const findById = async (id_demande, conn) => {
  const rows = await executor(conn)(
    `SELECT d.*, e.type_expediteur, e.nom_complet AS expediteur_nom, e.telephone AS expediteur_telephone,
            z.nom_zone, z.ville
     FROM demande d
     JOIN expediteur e ON e.id_expediteur = d.id_expediteur
     JOIN zone z ON z.id_zone = d.id_zone_recuperation
     WHERE d.id_demande = :id_demande`,
    { id_demande }
  );
  return rows[0] || null;
};

// Verrouille la ligne pendant la transaction (évite les conflits annulation / paiement)
const findByIdForUpdate = async (conn, id_demande) => {
  const rows = await executor(conn)('SELECT * FROM demande WHERE id_demande = :id_demande FOR UPDATE', { id_demande });
  return rows[0] || null;
};

// numero_suivi est provisoire à l'insertion : il dépend de l'identifiant, fixé juste après
const create = async (conn, d) => {
  const result = await executor(conn)(
    `INSERT INTO demande (numero_suivi, id_expediteur, adresse_recuperation, latitude_recuperation, longitude_recuperation,
        id_zone_recuperation, adresse_livraison, latitude_livraison, longitude_livraison, distance_estimee, frais_estimes)
     VALUES (:numero_suivi, :id_expediteur, :adresse_recuperation, :latitude_recuperation, :longitude_recuperation,
        :id_zone_recuperation, :adresse_livraison, :latitude_livraison, :longitude_livraison, :distance_estimee, :frais_estimes)`,
    d
  );
  return result.insertId;
};

const setNumeroSuivi = (conn, id_demande, numero_suivi) =>
  executor(conn)('UPDATE demande SET numero_suivi = :numero_suivi WHERE id_demande = :id_demande', { id_demande, numero_suivi });

const markCancelled = (conn, id_demande, motif) =>
  executor(conn)(
    "UPDATE demande SET statut = 'annulee', date_annulation = NOW(), motif_annulation = :motif WHERE id_demande = :id_demande",
    { id_demande, motif: motif ?? null }
  );

// Les paiements encore en cours d'une demande annulée sont annulés
const cancelPendingPayments = (conn, id_demande) =>
  executor(conn)("UPDATE paiement SET statut = 'annule' WHERE id_demande = :id_demande AND statut = 'en_cours'", { id_demande });

module.exports = { list, findById, findByIdForUpdate, create, setNumeroSuivi, markCancelled, cancelPendingPayments };