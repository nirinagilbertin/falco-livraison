const { executor } = require('../config/db');
const { buildLimit } = require('../utils/sql');

// Minutes insérées en entier dans le SQL (valeur issue d'un paramètre validé) : évite les soucis de type avec INTERVAL
const minutes = (m) => {
  const n = Math.trunc(Number(m));
  return Number.isFinite(n) && n > 0 ? n : 15;
};

const COLUMNS = `a.id_affectation, a.id_livraison, a.id_livreur, a.id_vehicule, a.id_utilisateur_proposant,
  a.type_recuperation, a.statut, a.date_proposition, a.date_reponse`;

// ---------- lecture ----------
const findById = async (id_affectation, delayMin, conn) => {
  const rows = await executor(conn)(
    `SELECT ${COLUMNS}, DATE_ADD(a.date_proposition, INTERVAL ${minutes(delayMin)} MINUTE) AS expire_le
     FROM affectation a WHERE a.id_affectation = :id_affectation`,
    { id_affectation }
  );
  return rows[0] || null;
};

const findByIdForUpdate = async (conn, id_affectation, delayMin) => {
  const rows = await executor(conn)(
    `SELECT ${COLUMNS}, (a.date_proposition < DATE_SUB(NOW(), INTERVAL ${minutes(delayMin)} MINUTE)) AS depassee
     FROM affectation a WHERE a.id_affectation = :id_affectation FOR UPDATE`,
    { id_affectation }
  );
  return rows[0] || null;
};

const findPendingByLivraison = (conn, id_livraison) =>
  executor(conn)("SELECT id_affectation, id_livreur FROM affectation WHERE id_livraison = :id_livraison AND statut = 'en_attente'", { id_livraison });

// Propositions encore ouvertes (en attente de réponse ou acceptées) : utilisé par l'annulation d'une demande
const findOpenByLivraison = (conn, id_livraison) =>
  executor(conn)(
    `SELECT id_affectation, id_livreur, id_vehicule, statut FROM affectation
     WHERE id_livraison = :id_livraison AND statut IN ('en_attente', 'acceptee') FOR UPDATE`,
    { id_livraison }
  );

// Propositions dont le délai de réponse est dépassé
const findOverdueIds = async (delayMin) => {
  const rows = await executor()(
    `SELECT id_affectation FROM affectation
     WHERE statut = 'en_attente' AND date_proposition < DATE_SUB(NOW(), INTERVAL ${minutes(delayMin)} MINUTE)
     ORDER BY id_affectation`
  );
  return rows.map((r) => r.id_affectation);
};

// Missions d'un livreur (CU-11 côté livreur)
const listByLivreur = async (id_livreur, { statut }, delayMin, pagination) => {
  const params = { id_livreur };
  let filter = '';
  if (statut) { filter = 'AND a.statut = :statut'; params.statut = statut; }
  const run = executor();
  const items = await run(
    `SELECT a.id_affectation, a.id_livraison, a.statut, a.type_recuperation, a.date_proposition, a.date_reponse,
            DATE_ADD(a.date_proposition, INTERVAL ${minutes(delayMin)} MINUTE) AS expire_le,
            li.statut AS statut_livraison, d.numero_suivi, d.adresse_recuperation, d.adresse_livraison, d.distance_estimee,
            (SELECT COALESCE(SUM(c.poids_estime), 0) FROM colis c WHERE c.id_demande = d.id_demande) AS poids_total,
            (SELECT COUNT(*) FROM colis c WHERE c.id_demande = d.id_demande) AS nb_colis
     FROM affectation a
     JOIN livraison li ON li.id_livraison = a.id_livraison
     JOIN demande d ON d.id_demande = li.id_demande
     WHERE a.id_livreur = :id_livreur ${filter}
     ORDER BY a.date_proposition DESC, a.id_affectation DESC ${buildLimit(pagination)}`,
    params
  );
  const [{ total }] = await run(`SELECT COUNT(*) AS total FROM affectation a WHERE a.id_livreur = :id_livreur ${filter}`, params);
  return { items, total };
};

// Historique des propositions d'une livraison (CU-12)
const listByLivraison = (id_livraison, delayMin) =>
  executor()(
    `SELECT ${COLUMNS}, DATE_ADD(a.date_proposition, INTERVAL ${minutes(delayMin)} MINUTE) AS expire_le,
            lv.nom AS livreur_nom, lv.prenom AS livreur_prenom, v.immatriculation
     FROM affectation a
     JOIN livreur lv ON lv.id_livreur = a.id_livreur
     JOIN vehicule v ON v.id_vehicule = a.id_vehicule
     WHERE a.id_livraison = :id_livraison ORDER BY a.date_proposition, a.id_affectation`,
    { id_livraison }
  );

const findDetail = async (id_affectation, delayMin) => {
  const rows = await executor()(
    `SELECT ${COLUMNS}, DATE_ADD(a.date_proposition, INTERVAL ${minutes(delayMin)} MINUTE) AS expire_le,
            lv.nom AS livreur_nom, lv.prenom AS livreur_prenom, lv.id_compte AS livreur_id_compte, v.immatriculation, v.type_vehicule,
            li.statut AS statut_livraison, d.id_demande, d.numero_suivi,
            d.adresse_recuperation, d.latitude_recuperation, d.longitude_recuperation,
            d.adresse_livraison, d.latitude_livraison, d.longitude_livraison, d.distance_estimee,
            e.nom_complet AS expediteur_nom, e.telephone AS expediteur_telephone,
            (SELECT COALESCE(SUM(c.poids_estime), 0) FROM colis c WHERE c.id_demande = d.id_demande) AS poids_total
     FROM affectation a
     JOIN livreur lv ON lv.id_livreur = a.id_livreur
     JOIN vehicule v ON v.id_vehicule = a.id_vehicule
     JOIN livraison li ON li.id_livraison = a.id_livraison
     JOIN demande d ON d.id_demande = li.id_demande
     JOIN expediteur e ON e.id_expediteur = d.id_expediteur
     WHERE a.id_affectation = :id_affectation`,
    { id_affectation }
  );
  return rows[0] || null;
};

// ---------- éligibilité (R34, R35) ----------
// Livreurs éligibles : compte actif et activé, libre, véhicule disponible assez grand, zone couverte,
// sans proposition en attente (ni pour lui, ni pour son véhicule).
const findCandidates = ({ id_livraison, id_zone, poids, excludeDeclined }) =>
  executor()(
    `SELECT l.id_livreur, l.id_compte, l.nom, l.prenom, l.telephone, l.id_vehicule,
            v.immatriculation, v.type_vehicule, v.capacite_poids,
            l.derniere_latitude, l.derniere_longitude, l.date_derniere_position
     FROM livreur l
     JOIN compte c ON c.id_compte = l.id_compte AND c.statut = 'actif' AND c.mot_de_passe_temporaire = 0
     JOIN vehicule v ON v.id_vehicule = l.id_vehicule AND v.statut = 'disponible' AND v.capacite_poids >= :poids
     JOIN livreur_zone lz ON lz.id_livreur = l.id_livreur AND lz.id_zone = :id_zone
     WHERE l.disponibilite = 'libre'
       AND NOT EXISTS (SELECT 1 FROM affectation p WHERE p.id_livreur = l.id_livreur AND p.statut = 'en_attente')
       AND NOT EXISTS (SELECT 1 FROM affectation p WHERE p.id_vehicule = l.id_vehicule AND p.statut = 'en_attente')
       ${excludeDeclined
         ? `AND NOT EXISTS (SELECT 1 FROM affectation x WHERE x.id_livraison = :id_livraison
                              AND x.id_livreur = l.id_livreur AND x.statut IN ('refusee', 'expiree'))`
         : ''}`,
    excludeDeclined ? { id_livraison, id_zone, poids } : { id_zone, poids }
  );

// Éléments permettant d'expliquer pourquoi un livreur précis n'est pas éligible
const findEligibilityFacts = async (conn, id_livreur, id_zone) => {
  const rows = await executor(conn)(
    `SELECT l.id_livreur, l.id_compte, l.nom, l.prenom, l.disponibilite, l.id_vehicule,
            c.statut AS statut_compte, c.mot_de_passe_temporaire,
            v.statut AS vehicule_statut, v.capacite_poids,
            EXISTS (SELECT 1 FROM livreur_zone lz WHERE lz.id_livreur = l.id_livreur AND lz.id_zone = :id_zone) AS dans_zone,
            EXISTS (SELECT 1 FROM affectation p WHERE p.id_livreur = l.id_livreur AND p.statut = 'en_attente') AS proposition_en_attente,
            EXISTS (SELECT 1 FROM affectation p WHERE p.id_vehicule = l.id_vehicule AND p.statut = 'en_attente'
                      AND p.id_livreur <> l.id_livreur) AS vehicule_reserve
     FROM livreur l
     JOIN compte c ON c.id_compte = l.id_compte
     LEFT JOIN vehicule v ON v.id_vehicule = l.id_vehicule
     WHERE l.id_livreur = :id_livreur`,
    { id_livreur, id_zone }
  );
  return rows[0] || null;
};

// ---------- verrous ----------
const lockLivreur = async (conn, id_livreur) => {
  const rows = await executor(conn)('SELECT id_livreur, disponibilite, id_vehicule FROM livreur WHERE id_livreur = :id_livreur FOR UPDATE', { id_livreur });
  return rows[0] || null;
};

const lockVehicule = async (conn, id_vehicule) => {
  const rows = await executor(conn)('SELECT id_vehicule, statut FROM vehicule WHERE id_vehicule = :id_vehicule FOR UPDATE', { id_vehicule });
  return rows[0] || null;
};

// ---------- écriture ----------
const create = async (conn, { id_livraison, id_livreur, id_vehicule, id_utilisateur_proposant = null, type_recuperation = 'expediteur' }) => {
  const result = await executor(conn)(
    `INSERT INTO affectation (id_livraison, id_livreur, id_vehicule, id_utilisateur_proposant, type_recuperation)
     VALUES (:id_livraison, :id_livreur, :id_vehicule, :id_utilisateur_proposant, :type_recuperation)`,
    { id_livraison, id_livreur, id_vehicule, id_utilisateur_proposant, type_recuperation }
  );
  return result.insertId;
};

// acceptee, refusee, expiree ou annulee : la date de réponse est enregistrée
const setStatut = (conn, id_affectation, statut) =>
  executor(conn)('UPDATE affectation SET statut = :statut, date_reponse = NOW() WHERE id_affectation = :id_affectation', { id_affectation, statut });

const cancelOpen = (conn, id_livraison) =>
  executor(conn)(
    `UPDATE affectation SET statut = 'annulee', date_reponse = COALESCE(date_reponse, NOW())
     WHERE id_livraison = :id_livraison AND statut IN ('en_attente', 'acceptee')`,
    { id_livraison }
  );

// Le livreur devient occupé et son véhicule passe en service
const occupyLivreurAndVehicule = async (conn, { id_livreur, id_vehicule }) => {
  const run = executor(conn);
  await run("UPDATE livreur SET disponibilite = 'occupe' WHERE id_livreur = :id_livreur", { id_livreur });
  await run("UPDATE vehicule SET statut = 'en_service' WHERE id_vehicule = :id_vehicule", { id_vehicule });
};

// Libère le livreur et son véhicule (annulation, fin de livraison...)
const releaseLivreurAndVehicule = async (conn, { id_livreur, id_vehicule }) => {
  const run = executor(conn);
  await run("UPDATE livreur SET disponibilite = 'libre' WHERE id_livreur = :id_livreur AND disponibilite = 'occupe'", { id_livreur });
  await run("UPDATE vehicule SET statut = 'disponible' WHERE id_vehicule = :id_vehicule AND statut = 'en_service'", { id_vehicule });
};

module.exports = {
  findById, findByIdForUpdate, findPendingByLivraison, findOpenByLivraison, findOverdueIds,
  listByLivreur, listByLivraison, findDetail, findCandidates, findEligibilityFacts,
  lockLivreur, lockVehicule, create, setStatut, cancelOpen, occupyLivreurAndVehicule, releaseLivreurAndVehicule,
};