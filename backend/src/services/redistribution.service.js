const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const demandeRepository = require('../repositories/demande.repository');
const livraisonRepository = require('../repositories/livraison.repository');
const affectationRepository = require('../repositories/affectation.repository');
const executionRepository = require('../repositories/execution.repository');
const redistributionRepository = require('../repositories/redistribution.repository');
const profilRepository = require('../repositories/profil.repository');
const notificationService = require('./notification.service');
const auditService = require('./audit.service');
const affectationService = require('./affectation.service');

const START_HOUR = 6; // les remises en attente commencent à 6 h le jour commun

// Pourquoi un livreur ne peut pas reprendre un colis au dépôt (zones du dépôt, pas la zone de récupération)
const depotReasons = (f, poids) => {
  if (!f) return ['Livreur introuvable'];
  const reasons = [];
  if (f.statut_compte !== 'actif') reasons.push('Compte suspendu');
  if (f.mot_de_passe_temporaire) reasons.push('Mot de passe temporaire non changé (compte non activé)');
  if (f.disponibilite !== 'libre') reasons.push(`Livreur non disponible (${f.disponibilite})`);
  if (!f.id_vehicule) {
    reasons.push('Aucun véhicule habituel assigné');
  } else {
    if (f.vehicule_statut !== 'disponible') reasons.push(`Véhicule indisponible (${f.vehicule_statut})`);
    if (Number(f.capacite_poids) < Number(poids)) reasons.push(`Capacité du véhicule insuffisante (${f.capacite_poids} kg pour ${poids} kg)`);
    if (f.vehicule_reserve) reasons.push('Véhicule déjà réservé par une autre proposition');
  }
  if (!f.zone_ok) reasons.push('Aucune zone du dépôt n\'est couverte par ce livreur');
  if (f.has_pending) reasons.push('Une proposition est déjà en attente pour ce livreur');
  return reasons;
};

// Proposition de reprise au dépôt : mêmes verrous que l'affectation normale, éligibilité par zones du dépôt
const createDepotProposal = (liv, id_livreur, { proposant = null, user = null, manual = false } = {}) =>
  withTransaction(async (conn) => {
    await demandeRepository.findByIdForUpdate(conn, liv.id_demande);
    const livraison = await executionRepository.lockLivraison(conn, liv.id_livraison);
    if (!livraison || livraison.statut !== 'en_attente') {
      throw new AppError("La livraison n'est plus en attente", 409, 'LIVRAISON_NON_EN_ATTENTE');
    }

    // Verrous livreur puis véhicule avant toute lecture simple (instantané REPEATABLE READ)
    const locked = await affectationRepository.lockLivreur(conn, id_livreur);
    if (!locked) throw AppError.notFound('Livreur introuvable');
    if (locked.id_vehicule) await affectationRepository.lockVehicule(conn, locked.id_vehicule);

    if ((await affectationRepository.findPendingByLivraison(conn, liv.id_livraison)).length > 0) {
      throw new AppError('Une proposition est déjà en attente de réponse pour cette livraison', 409, 'PROPOSITION_EN_ATTENTE');
    }

    const facts = await redistributionRepository.findDepotEligibilityFacts(conn, id_livreur, liv.id_depot);
    const reasons = depotReasons(facts, liv.poids_total);
    if (reasons.length > 0) throw new AppError('Ce livreur ne peut pas recevoir la mission', 409, 'NOT_ELIGIBLE', reasons);

    const id_affectation = await affectationRepository.create(conn, {
      id_livraison: liv.id_livraison,
      id_livreur,
      id_vehicule: facts.id_vehicule,
      id_utilisateur_proposant: proposant,
      type_recuperation: 'depot',
    });
    await auditService.log(
      {
        id_compte: user ? user.id_compte : null, action: 'proposition', type_objet: 'affectation', id_objet: id_affectation,
        details: `${liv.numero_suivi} -> livreur ${id_livreur} (reprise au dépôt, ${manual ? 'manuelle' : 'automatique'})`,
      },
      conn
    );
    await notificationService.notifyAccount(conn, {
      id_compte: facts.id_compte,
      type: 'mission_proposee',
      libelle: `Nouvelle mission ${liv.numero_suivi} : reprise du colis au dépôt`,
      id_livraison: liv.id_livraison,
    });
    return id_affectation;
  });

// Jour commun : la livraison inachevée repasse « En attente » (opération autorisée et tracée, R24)
const reactivateOne = (row) =>
  withTransaction(async (conn) => {
    const demande = await demandeRepository.findByIdForUpdate(conn, row.id_demande);
    const livraison = await executionRepository.lockLivraison(conn, row.id_livraison);
    if (!demande || demande.statut !== 'validee' || !livraison || livraison.statut !== 'inachevee') return false;

    await redistributionRepository.reactivate(conn, row.id_livraison);
    await livraisonRepository.insertHistorique(conn, {
      id_livraison: row.id_livraison, ancien_statut: 'inachevee', nouveau_statut: 'en_attente', id_compte: null,
      motif: 'Redistribution hebdomadaire',
    });
    await auditService.log(
      { id_compte: null, action: 'redistribution', type_objet: 'livraison', id_objet: row.id_livraison, details: row.numero_suivi },
      conn
    );
    await notificationService.notifyAccount(conn, {
      id_compte: row.expediteur_id_compte, type: 'changement_statut',
      libelle: `Nouvelle tentative de livraison en préparation pour votre colis (${row.numero_suivi})`,
      id_livraison: row.id_livraison,
    });
    return true;
  });

// Propositions par vagues : un livreur libre à la fois, jusqu'à épuisement des colis du dépôt (R28).
// Attendre des livreurs occupés n'est pas une anomalie : aucune alerte n'est créée ici.
const proposeWaves = async () => {
  const waiting = await redistributionRepository.findWaitingDepotLivraisons();
  let proposed = 0;

  for (const liv of waiting) {
    const candidates = await redistributionRepository.findDepotCandidates({
      id_livraison: liv.id_livraison, id_depot: liv.id_depot, poids: liv.poids_total,
    });
    for (const candidate of candidates) {
      try {
        await createDepotProposal(liv, candidate.id_livreur);
        proposed += 1;
        break;
      } catch (err) {
        if (err.code === 'NOT_ELIGIBLE') continue; // un autre livreur
        if (err.code !== 'PROPOSITION_EN_ATTENTE' && err.code !== 'LIVRAISON_NON_EN_ATTENTE') {
          console.error(`Redistribution : proposition impossible pour ${liv.numero_suivi} :`, err.message);
        }
        break;
      }
    }
  }
  return proposed;
};

// ignoreHour : lancement manuel, sans attendre l'heure de début
const run = async ({ ignoreHour = false } = {}) => {
  const due = await redistributionRepository.findDueInachevees(ignoreHour ? 0 : START_HOUR);
  let reactivated = 0;
  for (const row of due) {
    try {
      if (await reactivateOne(row)) reactivated += 1;
    } catch (err) {
      console.error(`Redistribution : remise en attente impossible pour ${row.numero_suivi} :`, err.message);
    }
  }
  return { reactivated, proposed: await proposeWaves() };
};

// CU-11, A3 : le gestionnaire impose un livreur pour une livraison reprise au dépôt
const assignToLivreur = async (user, id_livraison, id_livreur) => {
  const liv = await redistributionRepository.findDepotLivraison(id_livraison);
  if (!liv) throw AppError.notFound('Livraison introuvable');
  if (liv.id_depot === null) {
    throw AppError.conflict("Cette livraison n'est pas une reprise au dépôt : utilisez la réaffectation normale");
  }
  const manager = await profilRepository.findByCompte(user.role, user.id_compte);
  const id_affectation = await createDepotProposal(liv, id_livreur, {
    proposant: manager ? manager.id_utilisateur : null, user, manual: true,
  });
  return affectationService.getDetail(user, id_affectation);
};

module.exports = { run, proposeWaves, assignToLivreur };