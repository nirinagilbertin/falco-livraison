const { executor } = require('../config/db');

// Minutes insérées en entier dans le SQL (valeur issue d'un paramètre validé)
const minutes = (m) => {
  const n = Math.trunc(Number(m));
  return Number.isFinite(n) && n > 0 ? n : 30;
};

// ---------- lecture ----------
// Données stables d'une livraison (lecture simple, hors transaction)
const findContext = async (id_livraison) => {
  const rows = await executor()(
    `SELECT li.id_livraison, li.id_demande, d.numero_suivi, d.id_zone_recuperation, z.id_depot AS id_depot_zone,
            e.id_compte AS expediteur_id_compte
     FROM livraison li
     JOIN demande d ON d.id_demande = li.id_demande
     JOIN zone z ON z.id_zone = d.id_zone_recuperation
     JOIN expediteur e ON e.id_expediteur = d.id_expediteur
     WHERE li.id_livraison = :id_livraison`,
    { id_livraison }
  );
  return rows[0] || null;
};

const findDemandeSummary = async (id_demande) => {
  const rows = await executor()(
    'SELECT id_demande, id_expediteur, numero_suivi, statut, frais_estimes, frais_definitifs, date_verification FROM demande WHERE id_demande = :id_demande',
    { id_demande }
  );
  return rows[0] || null;
};

const findDestinataire = async (id_destinataire, id_demande) => {
  const rows = await executor()(
    'SELECT id_destinataire, nom, prenom FROM destinataire WHERE id_destinataire = :id_destinataire AND id_demande = :id_demande',
    { id_destinataire, id_demande }
  );
  return rows[0] || null;
};

const findDepot = async (id_depot) => {
  const rows = await executor()('SELECT id_depot, nom, statut FROM depot WHERE id_depot = :id_depot', { id_depot });
  return rows[0] || null;
};

// Tarifs existant à la date de création de la demande : les tarifs ne sont jamais modifiés ni supprimés
const findTariffsCreatedBefore = (date) =>
  executor()(
    `SELECT id_tarif, frais_base, prix_par_km, prix_par_kg FROM tarif
     WHERE date_creation <= :date ORDER BY date_creation DESC, id_tarif DESC`,
    { date }
  );

// Date limite de paiement d'une demande vérifiée
const findPaymentDeadline = async (id_demande, delayMin) => {
  const rows = await executor()(
    `SELECT DATE_ADD(date_verification, INTERVAL ${minutes(delayMin)} MINUTE) AS paiement_avant FROM demande WHERE id_demande = :id_demande`,
    { id_demande }
  );
  return rows[0] ? rows[0].paiement_avant : null;
};

const isPaymentOverdue = async (conn, id_demande, delayMin) => {
  const rows = await executor(conn)(
    `SELECT (date_verification < DATE_SUB(NOW(), INTERVAL ${minutes(delayMin)} MINUTE)) AS depassee FROM demande WHERE id_demande = :id_demande`,
    { id_demande }
  );
  return Boolean(rows[0] && rows[0].depassee);
};

const findUnpaidOverdueIds = async (delayMin) => {
  const rows = await executor()(
    `SELECT id_demande FROM demande
     WHERE statut = 'verifiee' AND date_verification < DATE_SUB(NOW(), INTERVAL ${minutes(delayMin)} MINUTE)
     ORDER BY id_demande`
  );
  return rows.map((r) => r.id_demande);
};

// Compte du livreur affecté (proposition acceptée) à la livraison d'une demande
const findAcceptedLivreurAccount = async (conn, id_demande) => {
  const rows = await executor(conn)(
    `SELECT lv.id_compte, li.id_livraison
     FROM livraison li
     JOIN affectation a ON a.id_livraison = li.id_livraison AND a.statut = 'acceptee'
     JOIN livreur lv ON lv.id_livreur = a.id_livreur
     WHERE li.id_demande = :id_demande`,
    { id_demande }
  );
  return rows[0] || null;
};

const findOwnerCompte = async (conn, id_demande) => {
  const rows = await executor(conn)(
    'SELECT e.id_compte FROM demande d JOIN expediteur e ON e.id_expediteur = d.id_expediteur WHERE d.id_demande = :id_demande',
    { id_demande }
  );
  return rows[0] ? rows[0].id_compte : null;
};

// ---------- verrous ----------
const lockLivraison = async (conn, id_livraison) => {
  const rows = await executor(conn)('SELECT id_livraison, id_demande, statut FROM livraison WHERE id_livraison = :id_livraison FOR UPDATE', { id_livraison });
  return rows[0] || null;
};

// Proposition acceptée de la livraison, avec le livreur et la capacité de son véhicule
const findAcceptedAffectationForUpdate = async (conn, id_livraison) => {
  const rows = await executor(conn)(
    `SELECT a.id_affectation, a.id_livreur, a.id_vehicule, a.type_recuperation,
            lv.id_compte AS livreur_id_compte, v.capacite_poids
     FROM affectation a
     JOIN livreur lv ON lv.id_livreur = a.id_livreur
     JOIN vehicule v ON v.id_vehicule = a.id_vehicule
     WHERE a.id_livraison = :id_livraison AND a.statut = 'acceptee' FOR UPDATE`,
    { id_livraison }
  );
  return rows[0] || null;
};

const findColisForUpdate = (conn, id_demande) =>
  executor(conn)(
    `SELECT id_colis, poids_estime, poids_reel, longueur, largeur, hauteur, statut
     FROM colis WHERE id_demande = :id_demande ORDER BY id_colis FOR UPDATE`,
    { id_demande }
  );

// ---------- écriture : colis ----------
// Poids réel obligatoire ; dimensions conservées si elles ne sont pas corrigées
const updateColisVerification = (conn, id_colis, { poids_reel, longueur, largeur, hauteur }) =>
  executor(conn)(
    `UPDATE colis SET poids_reel = :poids_reel, longueur = COALESCE(:longueur, longueur),
            largeur = COALESCE(:largeur, largeur), hauteur = COALESCE(:hauteur, hauteur)
     WHERE id_colis = :id_colis`,
    { id_colis, poids_reel, longueur: longueur ?? null, largeur: largeur ?? null, hauteur: hauteur ?? null }
  );

const markColisRecupere = (conn, id_demande) =>
  executor(conn)("UPDATE colis SET statut = 'recupere' WHERE id_demande = :id_demande AND statut IN ('a_recuperer', 'depose')", { id_demande });

const markColisLivre = (conn, id_demande) =>
  executor(conn)("UPDATE colis SET statut = 'livre' WHERE id_demande = :id_demande AND statut = 'recupere'", { id_demande });

// Renvoie le nombre de colis déposés (0 : rien à déposer)
const markColisDepose = async (conn, id_demande, { id_depot, id_utilisateur }) => {
  const result = await executor(conn)(
    `UPDATE colis SET statut = 'depose', id_depot = :id_depot, date_depot = NOW(), id_utilisateur_depot = :id_utilisateur
     WHERE id_demande = :id_demande AND statut = 'recupere'`,
    { id_demande, id_depot, id_utilisateur: id_utilisateur ?? null }
  );
  return result.affectedRows;
};

// ---------- écriture : demande ----------
const markDemandeVerifiee = (conn, id_demande, frais_definitifs) =>
  executor(conn)(
    "UPDATE demande SET statut = 'verifiee', frais_definitifs = :frais_definitifs, date_verification = NOW() WHERE id_demande = :id_demande",
    { id_demande, frais_definitifs }
  );

const markDemandeValidee = (conn, id_demande) =>
  executor(conn)("UPDATE demande SET statut = 'validee', date_validation = NOW() WHERE id_demande = :id_demande", { id_demande });

// ---------- écriture : livraison ----------
const markLivraisonEnCours = (conn, id_livraison) =>
  executor(conn)("UPDATE livraison SET statut = 'en_cours', date_debut = NOW() WHERE id_livraison = :id_livraison", { id_livraison });

const markLivraisonTerminee = (conn, { id_livraison, id_destinataire, methode_verification }) =>
  executor(conn)(
    `UPDATE livraison SET statut = 'terminee', date_fin = NOW(), id_destinataire_recepteur = :id_destinataire,
            methode_verification = :methode_verification WHERE id_livraison = :id_livraison`,
    { id_livraison, id_destinataire, methode_verification }
  );

const markLivraisonInachevee = (conn, { id_livraison, motif }) =>
  executor(conn)(
    "UPDATE livraison SET statut = 'inachevee', motif_inachevement = :motif WHERE id_livraison = :id_livraison",
    { id_livraison, motif: String(motif).slice(0, 255) }
  );

const setReprogrammation = (conn, id_livraison, date) =>
  executor(conn)('UPDATE livraison SET date_reprogrammation = :date WHERE id_livraison = :id_livraison', { id_livraison, date });

module.exports = {
  findContext, findDemandeSummary, findDestinataire, findDepot, findTariffsCreatedBefore, findPaymentDeadline, isPaymentOverdue,
  findUnpaidOverdueIds, findAcceptedLivreurAccount, findOwnerCompte, lockLivraison, findAcceptedAffectationForUpdate, findColisForUpdate,
  updateColisVerification, markColisRecupere, markColisLivre, markColisDepose, markDemandeVerifiee, markDemandeValidee,
  markLivraisonEnCours, markLivraisonTerminee, markLivraisonInachevee, setReprogrammation,
};