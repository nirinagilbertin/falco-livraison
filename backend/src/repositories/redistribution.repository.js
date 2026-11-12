const { executor } = require('../config/db');

const hour = (h) => Math.min(23, Math.max(0, Math.trunc(Number(h)) || 0));

// Livraisons inachevées dont le jour de reprogrammation est atteint (à partir de l'heure de début)
const findDueInachevees = (startHour) =>
  executor()(
    `SELECT li.id_livraison, li.id_demande, d.numero_suivi, e.id_compte AS expediteur_id_compte
     FROM livraison li
     JOIN demande d ON d.id_demande = li.id_demande
     JOIN expediteur e ON e.id_expediteur = d.id_expediteur
     WHERE li.statut = 'inachevee' AND li.date_reprogrammation IS NOT NULL
       AND (li.date_reprogrammation < CURDATE()
            OR (li.date_reprogrammation = CURDATE() AND HOUR(NOW()) >= ${hour(startHour)}))
       AND EXISTS (SELECT 1 FROM colis c WHERE c.id_demande = d.id_demande AND c.statut = 'depose')
       AND NOT EXISTS (SELECT 1 FROM colis c WHERE c.id_demande = d.id_demande AND c.statut <> 'depose')
     ORDER BY li.date_reprogrammation, li.id_livraison`
  );

// L'ancienne mission acceptée est clôturée (libère l'unicité « une seule affectation acceptée ») et la livraison repasse en attente
const reactivate = async (conn, id_livraison) => {
  const run = executor(conn);
  await run("UPDATE affectation SET statut = 'annulee' WHERE id_livraison = :id_livraison AND statut = 'acceptee'", { id_livraison });
  await run("UPDATE livraison SET statut = 'en_attente', date_reprogrammation = NULL WHERE id_livraison = :id_livraison", { id_livraison });
};

const DEPOT_LIVRAISON = `
  SELECT li.id_livraison, li.id_demande, li.statut, d.numero_suivi,
         (SELECT c.id_depot FROM colis c WHERE c.id_demande = d.id_demande AND c.statut = 'depose' LIMIT 1) AS id_depot,
         (SELECT COALESCE(SUM(COALESCE(c.poids_reel, c.poids_estime)), 0) FROM colis c WHERE c.id_demande = d.id_demande) AS poids_total
  FROM livraison li JOIN demande d ON d.id_demande = li.id_demande`;

// Livraisons en attente dont le colis est au dépôt et qui n'ont pas de proposition ouverte
const findWaitingDepotLivraisons = () =>
  executor()(
    `${DEPOT_LIVRAISON}
     WHERE li.statut = 'en_attente'
       AND EXISTS (SELECT 1 FROM colis c WHERE c.id_demande = d.id_demande AND c.statut = 'depose')
       AND NOT EXISTS (SELECT 1 FROM affectation a WHERE a.id_livraison = li.id_livraison AND a.statut = 'en_attente')
     ORDER BY li.id_livraison`
  );

const findDepotLivraison = async (id_livraison) => {
  const rows = await executor()(`${DEPOT_LIVRAISON} WHERE li.id_livraison = :id_livraison`, { id_livraison });
  return rows[0] || null;
};

// Livreurs libres des zones du dépôt, sans calcul de proximité (R28). Sont exclus ceux qui ont déjà refusé
// ou laissé expirer cette livraison depuis sa dernière remise en attente.
const findDepotCandidates = ({ id_livraison, id_depot, poids }) =>
  executor()(
    `SELECT l.id_livreur, l.id_compte, l.nom, l.prenom, l.id_vehicule
     FROM livreur l
     JOIN compte c ON c.id_compte = l.id_compte AND c.statut = 'actif' AND c.mot_de_passe_temporaire = 0
     JOIN vehicule v ON v.id_vehicule = l.id_vehicule AND v.statut = 'disponible' AND v.capacite_poids >= :poids
     WHERE l.disponibilite = 'libre'
       AND EXISTS (SELECT 1 FROM livreur_zone lz JOIN zone z ON z.id_zone = lz.id_zone
                   WHERE lz.id_livreur = l.id_livreur AND z.id_depot = :id_depot AND z.statut = 'active')
       AND NOT EXISTS (SELECT 1 FROM affectation p WHERE p.id_livreur = l.id_livreur AND p.statut = 'en_attente')
       AND NOT EXISTS (SELECT 1 FROM affectation p WHERE p.id_vehicule = l.id_vehicule AND p.statut = 'en_attente')
       AND NOT EXISTS (
         SELECT 1 FROM affectation x
         WHERE x.id_livraison = :id_livraison AND x.id_livreur = l.id_livreur AND x.statut IN ('refusee', 'expiree')
           AND x.date_proposition >= COALESCE(
             (SELECT MAX(h.date_changement) FROM historique_statut_livraison h
              WHERE h.id_livraison = :id_livraison AND h.ancien_statut = 'inachevee' AND h.nouveau_statut = 'en_attente'),
             '1970-01-01'))
     ORDER BY l.id_livreur`,
    { id_livraison, id_depot, poids }
  );

// Faits d'éligibilité relus sous verrou avant de créer la proposition
const findDepotEligibilityFacts = async (conn, id_livreur, id_depot) => {
  const rows = await executor(conn)(
    `SELECT l.id_livreur, l.id_compte, l.disponibilite, l.id_vehicule,
            c.statut AS statut_compte, c.mot_de_passe_temporaire,
            v.statut AS vehicule_statut, v.capacite_poids,
            EXISTS (SELECT 1 FROM livreur_zone lz JOIN zone z ON z.id_zone = lz.id_zone
                    WHERE lz.id_livreur = l.id_livreur AND z.id_depot = :id_depot AND z.statut = 'active') AS zone_ok,
            EXISTS (SELECT 1 FROM affectation p WHERE p.id_livreur = l.id_livreur AND p.statut = 'en_attente') AS has_pending,
            EXISTS (SELECT 1 FROM affectation p WHERE l.id_vehicule IS NOT NULL AND p.id_vehicule = l.id_vehicule
                    AND p.statut = 'en_attente') AS vehicule_reserve
     FROM livreur l
     JOIN compte c ON c.id_compte = l.id_compte
     LEFT JOIN vehicule v ON v.id_vehicule = l.id_vehicule
     WHERE l.id_livreur = :id_livreur`,
    { id_livreur, id_depot }
  );
  return rows[0] || null;
};

module.exports = {
  findDueInachevees, reactivate, findWaitingDepotLivraisons, findDepotLivraison, findDepotCandidates, findDepotEligibilityFacts,
};