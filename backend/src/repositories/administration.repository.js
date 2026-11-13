const { executor } = require('../config/db');
const { likeParam, buildWhere, buildLimit } = require('../utils/sql');

// CU-23 : paiements simulés (aucune donnée sensible : seulement des champs masqués)
const listPaiements = async ({ statut, mode_paiement, id_expediteur, du, au, q }, pagination) => {
  const clauses = [];
  const params = {};
  if (statut) { clauses.push('p.statut = :statut'); params.statut = statut; }
  if (mode_paiement) { clauses.push('p.mode_paiement = :mode_paiement'); params.mode_paiement = mode_paiement; }
  if (id_expediteur) { clauses.push('e.id_expediteur = :id_expediteur'); params.id_expediteur = id_expediteur; }
  if (du) { clauses.push('p.date_creation >= :du'); params.du = du; }
  if (au) { clauses.push('p.date_creation < DATE_ADD(:au, INTERVAL 1 DAY)'); params.au = au; }
  if (q) {
    clauses.push('(p.reference_paiement LIKE :q OR p.numero_recu LIKE :q OR d.numero_suivi LIKE :q OR e.nom_complet LIKE :q)');
    params.q = likeParam(q);
  }
  const where = buildWhere(clauses);
  const from = `FROM paiement p
    JOIN demande d ON d.id_demande = p.id_demande
    JOIN expediteur e ON e.id_expediteur = d.id_expediteur`;
  const run = executor();

  const items = await run(
    `SELECT p.id_paiement, p.id_demande, d.numero_suivi, e.id_expediteur, e.nom_complet AS expediteur,
            p.montant, p.mode_paiement, p.statut, p.motif_echec, p.carte_derniers_chiffres, p.operateur_mobile,
            p.numero_payeur, p.reference_paiement, p.numero_recu, p.date_creation, p.date_paiement
     ${from} ${where} ORDER BY p.date_creation DESC, p.id_paiement DESC ${buildLimit(pagination)}`,
    params
  );
  const [totals] = await run(
    `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN p.statut = 'valide' THEN p.montant ELSE 0 END), 0) AS total_valide ${from} ${where}`,
    params
  );
  return { items, total: totals.total, totalValide: totals.total_valide };
};

// Journal d'audit minimal : qui, quelle action, sur quoi, quand
const listAudit = async ({ id_compte, action, type_objet, id_objet, du, au, q }, pagination) => {
  const clauses = [];
  const params = {};
  if (id_compte) { clauses.push('j.id_compte = :id_compte'); params.id_compte = id_compte; }
  if (action) { clauses.push('j.action = :action'); params.action = action; }
  if (type_objet) { clauses.push('j.type_objet = :type_objet'); params.type_objet = type_objet; }
  if (id_objet) { clauses.push('j.id_objet = :id_objet'); params.id_objet = id_objet; }
  if (du) { clauses.push('j.date_action >= :du'); params.du = du; }
  if (au) { clauses.push('j.date_action < DATE_ADD(:au, INTERVAL 1 DAY)'); params.au = au; }
  if (q) { clauses.push('j.details LIKE :q'); params.q = likeParam(q); }
  const where = buildWhere(clauses);
  const run = executor();

  const items = await run(
    `SELECT j.id_journal, j.id_compte, c.email, c.nom_utilisateur, c.role, j.action, j.type_objet, j.id_objet, j.details, j.date_action
     FROM journal_audit j LEFT JOIN compte c ON c.id_compte = j.id_compte
     ${where} ORDER BY j.date_action DESC, j.id_journal DESC ${buildLimit(pagination)}`,
    params
  );
  const [{ total }] = await run(`SELECT COUNT(*) AS total FROM journal_audit j ${where}`, params);
  return { items, total };
};

module.exports = { listPaiements, listAudit };