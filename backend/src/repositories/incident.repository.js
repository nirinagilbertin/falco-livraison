const { executor } = require('../config/db');
const { buildWhere, buildLimit } = require('../utils/sql');

const SELECT = `SELECT i.id_incident, i.id_livraison, d.numero_suivi, i.type_incident, i.description, i.statut,
  i.id_declarant, c.nom_utilisateur AS declarant, c.role AS declarant_role,
  i.id_responsable, CONCAT(ui.prenom, ' ', ui.nom) AS responsable, i.date_creation, i.date_resolution
  FROM incident i
  JOIN livraison li ON li.id_livraison = i.id_livraison
  JOIN demande d ON d.id_demande = li.id_demande
  JOIN compte c ON c.id_compte = i.id_declarant
  LEFT JOIN utilisateur_interne ui ON ui.id_utilisateur = i.id_responsable`;

// Livraison concernée et comptes autorisés à y déclarer un incident (expéditeur, livreur affecté)
const findLivraisonAccess = async (id_livraison) => {
  const rows = await executor()(
    `SELECT li.id_livraison, li.statut, d.numero_suivi, e.id_compte AS expediteur_id_compte, lv.id_compte AS livreur_id_compte
     FROM livraison li
     JOIN demande d ON d.id_demande = li.id_demande
     JOIN expediteur e ON e.id_expediteur = d.id_expediteur
     LEFT JOIN affectation a ON a.id_livraison = li.id_livraison AND a.statut = 'acceptee'
     LEFT JOIN livreur lv ON lv.id_livreur = a.id_livreur
     WHERE li.id_livraison = :id_livraison`,
    { id_livraison }
  );
  return rows[0] || null;
};

const create = async (conn, { id_livraison, id_declarant, type_incident, description }) => {
  const result = await executor(conn)(
    'INSERT INTO incident (id_livraison, id_declarant, type_incident, description) VALUES (:id_livraison, :id_declarant, :type_incident, :description)',
    { id_livraison, id_declarant, type_incident, description }
  );
  return result.insertId;
};

// Alerte liée à un incident (selon sa gravité)
const createAlert = async (conn, { id_livraison, id_incident, libelle, niveau_priorite }) => {
  const result = await executor(conn)(
    `INSERT INTO alerte (id_livraison, id_incident, type_alerte, libelle, niveau_priorite)
     VALUES (:id_livraison, :id_incident, 'incident', :libelle, :niveau_priorite)`,
    { id_livraison, id_incident, libelle: String(libelle).slice(0, 255), niveau_priorite }
  );
  return result.insertId;
};

const list = async ({ statut, type_incident, id_livraison }, pagination, id_declarant = null) => {
  const clauses = [];
  const params = {};
  if (statut) { clauses.push('i.statut = :statut'); params.statut = statut; }
  if (type_incident) { clauses.push('i.type_incident = :type_incident'); params.type_incident = type_incident; }
  if (id_livraison) { clauses.push('i.id_livraison = :id_livraison'); params.id_livraison = id_livraison; }
  if (id_declarant) { clauses.push('i.id_declarant = :id_declarant'); params.id_declarant = id_declarant; }
  const where = buildWhere(clauses);
  const run = executor();

  const items = await run(`${SELECT} ${where} ORDER BY (i.statut = 'resolu'), i.date_creation DESC, i.id_incident DESC ${buildLimit(pagination)}`, params);
  const [{ total }] = await run(`SELECT COUNT(*) AS total FROM incident i ${where}`, params);
  return { items, total };
};

const findById = async (id_incident, conn) => {
  const rows = await executor(conn)(`${SELECT} WHERE i.id_incident = :id_incident`, { id_incident });
  return rows[0] || null;
};

const findAlerts = (id_incident) =>
  executor()(
    'SELECT id_alerte, niveau_priorite, statut, libelle, date_creation, date_resolution FROM alerte WHERE id_incident = :id_incident ORDER BY id_alerte',
    { id_incident }
  );

const lockById = async (conn, id_incident) => {
  const rows = await executor(conn)('SELECT id_incident, id_declarant, statut FROM incident WHERE id_incident = :id_incident FOR UPDATE', { id_incident });
  return rows[0] || null;
};

const takeOver = (conn, id_incident, id_responsable) =>
  executor(conn)("UPDATE incident SET statut = 'en_cours', id_responsable = :id_responsable WHERE id_incident = :id_incident", { id_incident, id_responsable });

const resolve = (conn, id_incident) =>
  executor(conn)("UPDATE incident SET statut = 'resolu', date_resolution = NOW() WHERE id_incident = :id_incident", { id_incident });

// Les alertes liées suivent le traitement de l'incident
const syncAlertsTakeOver = (conn, id_incident, id_responsable) =>
  executor(conn)(
    "UPDATE alerte SET statut = 'en_cours', id_responsable = :id_responsable WHERE id_incident = :id_incident AND statut = 'nouvelle'",
    { id_incident, id_responsable }
  );

const syncAlertsResolve = (conn, id_incident) =>
  executor(conn)("UPDATE alerte SET statut = 'resolue', date_resolution = NOW() WHERE id_incident = :id_incident AND statut <> 'resolue'", { id_incident });

module.exports = {
  findLivraisonAccess, create, createAlert, list, findById, findAlerts, lockById, takeOver, resolve, syncAlertsTakeOver, syncAlertsResolve,
};