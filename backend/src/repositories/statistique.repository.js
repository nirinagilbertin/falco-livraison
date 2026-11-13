const { executor } = require('../config/db');

// Période inclusive : du début du jour « du » à la fin du jour « au »
const inPeriod = (col) => `${col} >= :du AND ${col} < DATE_ADD(:au, INTERVAL 1 DAY)`;
const run = (sql, params = {}) => executor()(sql, params);

// ---------- tableau de bord global ----------
const demandesByStatut = (p) => run(`SELECT statut, COUNT(*) AS n FROM demande WHERE ${inPeriod('date_creation')} GROUP BY statut`, p);
const livraisonsByStatut = (p) => run(`SELECT statut, COUNT(*) AS n FROM livraison WHERE ${inPeriod('date_creation')} GROUP BY statut`, p);

const paiementsByStatutMode = (p) =>
  run(
    `SELECT statut, mode_paiement, COUNT(*) AS n, COALESCE(SUM(montant), 0) AS total
     FROM paiement WHERE ${inPeriod('date_creation')} GROUP BY statut, mode_paiement`,
    p
  );

const delais = async (p) => {
  const rows = await run(
    `SELECT
       (SELECT AVG(TIMESTAMPDIFF(MINUTE, date_debut, date_fin)) FROM livraison
          WHERE statut = 'terminee' AND date_debut IS NOT NULL AND ${inPeriod('date_fin')}) AS livraison_min,
       (SELECT AVG(TIMESTAMPDIFF(MINUTE, date_creation, date_affectation)) FROM livraison
          WHERE date_affectation IS NOT NULL AND ${inPeriod('date_creation')}) AS affectation_min`,
    p
  );
  return rows[0];
};

// État courant (hors période)
const livreursByDisponibilite = () =>
  run("SELECT l.disponibilite AS statut, COUNT(*) AS n FROM livreur l JOIN compte c ON c.id_compte = l.id_compte WHERE c.statut = 'actif' GROUP BY l.disponibilite");
const vehiculesByStatut = () => run('SELECT statut, COUNT(*) AS n FROM vehicule GROUP BY statut');
const alertesOuvertes = () => run("SELECT niveau_priorite AS statut, COUNT(*) AS n FROM alerte WHERE statut <> 'resolue' GROUP BY niveau_priorite");
const incidentsOuverts = () => run("SELECT statut, COUNT(*) AS n FROM incident WHERE statut <> 'resolu' GROUP BY statut");
const comptesActifs = () => run("SELECT role AS statut, COUNT(*) AS n FROM compte WHERE statut = 'actif' GROUP BY role");

// ---------- évolution (graphiques) ; fmt est une constante interne, jamais une valeur utilisateur ----------
const seriesDemandes = (p, fmt) =>
  run(`SELECT DATE_FORMAT(date_creation, '${fmt}') AS periode, COUNT(*) AS n FROM demande WHERE ${inPeriod('date_creation')} GROUP BY periode`, p);
const seriesTerminees = (p, fmt) =>
  run(`SELECT DATE_FORMAT(date_fin, '${fmt}') AS periode, COUNT(*) AS n FROM livraison WHERE statut = 'terminee' AND ${inPeriod('date_fin')} GROUP BY periode`, p);
const seriesRevenus = (p, fmt) =>
  run(`SELECT DATE_FORMAT(date_paiement, '${fmt}') AS periode, COALESCE(SUM(montant), 0) AS n FROM paiement WHERE statut = 'valide' AND ${inPeriod('date_paiement')} GROUP BY periode`, p);

// ---------- performance des livreurs ----------
// Les missions acceptées, terminées et inachevées viennent de l'historique des statuts (une ligne par tentative)
const histCount = (statut) =>
  `(SELECT COUNT(*) FROM historique_statut_livraison h WHERE h.id_compte = lv.id_compte
      AND h.nouveau_statut = '${statut}' AND ${inPeriod('h.date_changement')})`;
const affCount = (statut) =>
  `(SELECT COUNT(*) FROM affectation a WHERE a.id_livreur = lv.id_livreur AND a.statut = '${statut}'
      AND ${inPeriod('COALESCE(a.date_reponse, a.date_proposition)')})`;

const livreursPerformance = (p) =>
  run(
    `SELECT lv.id_livreur, lv.prenom, lv.nom, lv.disponibilite,
            ${histCount('affectee')} AS missions_acceptees,
            ${histCount('terminee')} AS terminees,
            ${histCount('inachevee')} AS inachevees,
            ${affCount('refusee')} AS refus,
            ${affCount('expiree')} AS expirees
     FROM livreur lv JOIN compte c ON c.id_compte = lv.id_compte
     WHERE c.statut = 'actif'
     ORDER BY terminees DESC, lv.nom, lv.prenom LIMIT 200`,
    p
  );

// ---------- statistiques personnelles ----------
const senderDemandes = (id_expediteur, p) =>
  run(`SELECT statut, COUNT(*) AS n FROM demande WHERE id_expediteur = :id_expediteur AND ${inPeriod('date_creation')} GROUP BY statut`, { ...p, id_expediteur });

const senderLivraisons = (id_expediteur, p) =>
  run(
    `SELECT li.statut, COUNT(*) AS n FROM livraison li JOIN demande d ON d.id_demande = li.id_demande
     WHERE d.id_expediteur = :id_expediteur AND ${inPeriod('d.date_creation')} GROUP BY li.statut`,
    { ...p, id_expediteur }
  );

const senderSpend = async (id_expediteur, p) => {
  const rows = await run(
    `SELECT COUNT(*) AS n, COALESCE(SUM(pa.montant), 0) AS total
     FROM paiement pa JOIN demande d ON d.id_demande = pa.id_demande
     WHERE d.id_expediteur = :id_expediteur AND pa.statut = 'valide' AND ${inPeriod('pa.date_paiement')}`,
    { ...p, id_expediteur }
  );
  return rows[0];
};

const incidentsDeclared = async (id_compte, p) => {
  const rows = await run(`SELECT COUNT(*) AS n FROM incident WHERE id_declarant = :id_compte AND ${inPeriod('date_creation')}`, { ...p, id_compte });
  return rows[0].n;
};

const courierStats = async (id_livreur, id_compte, p) => {
  const rows = await run(
    `SELECT
       (SELECT COUNT(*) FROM historique_statut_livraison h WHERE h.id_compte = :id_compte AND h.nouveau_statut = 'affectee' AND ${inPeriod('h.date_changement')}) AS missions_acceptees,
       (SELECT COUNT(*) FROM historique_statut_livraison h WHERE h.id_compte = :id_compte AND h.nouveau_statut = 'terminee' AND ${inPeriod('h.date_changement')}) AS terminees,
       (SELECT COUNT(*) FROM historique_statut_livraison h WHERE h.id_compte = :id_compte AND h.nouveau_statut = 'inachevee' AND ${inPeriod('h.date_changement')}) AS inachevees,
       (SELECT COUNT(*) FROM affectation a WHERE a.id_livreur = :id_livreur AND a.statut = 'refusee' AND ${inPeriod('COALESCE(a.date_reponse, a.date_proposition)')}) AS refus,
       (SELECT COUNT(*) FROM affectation a WHERE a.id_livreur = :id_livreur AND a.statut = 'expiree' AND ${inPeriod('COALESCE(a.date_reponse, a.date_proposition)')}) AS expirees,
       (SELECT COALESCE(SUM(d.distance_estimee), 0) FROM historique_statut_livraison h
          JOIN livraison li ON li.id_livraison = h.id_livraison JOIN demande d ON d.id_demande = li.id_demande
          WHERE h.id_compte = :id_compte AND h.nouveau_statut = 'terminee' AND ${inPeriod('h.date_changement')}) AS distance_km`,
    { ...p, id_livreur, id_compte }
  );
  return rows[0];
};

module.exports = {
  demandesByStatut, livraisonsByStatut, paiementsByStatutMode, delais, livreursByDisponibilite, vehiculesByStatut,
  alertesOuvertes, incidentsOuverts, comptesActifs, seriesDemandes, seriesTerminees, seriesRevenus, livreursPerformance,
  senderDemandes, senderLivraisons, senderSpend, incidentsDeclared, courierStats,
};