const crypto = require('crypto');
const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { simulatePayment } = require('../utils/paymentSimulator');
const demandeRepository = require('../repositories/demande.repository');
const paiementRepository = require('../repositories/paiement.repository');
const executionRepository = require('../repositories/execution.repository');
const profilRepository = require('../repositories/profil.repository');
const parametreService = require('./parametre.service');
const demandeService = require('./demande.service');
const notificationService = require('./notification.service');
const auditService = require('./audit.service');

const ar = (n) => `${new Intl.NumberFormat('fr-FR').format(n)} Ar`;

const getExpediteur = async (user) => {
  const profil = await profilRepository.findByCompte('expediteur', user.id_compte);
  if (!profil) throw AppError.forbidden('Réservé aux expéditeurs');
  return profil;
};

const newReference = () => `PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const STATUT_MESSAGE = {
  en_attente: "Le colis n'a pas encore été vérifié par le livreur",
  en_cours: "Le colis n'a pas encore été vérifié par le livreur",
  annulee: 'Cette demande est annulée',
};

// CU-08 : paiement simulé des frais définitifs, après la vérification du colis.
// Un paiement échoué est enregistré (historique des tentatives) et l'expéditeur peut réessayer.
const pay = async (user, id_demande, payload) => {
  const expediteur = await getExpediteur(user);
  const delay = await parametreService.getInt('delai_paiement_min');
  let outcome;

  try {
    outcome = await withTransaction(async (conn) => {
      const demande = await demandeRepository.findByIdForUpdate(conn, id_demande);
      if (!demande) throw AppError.notFound('Demande introuvable');
      if (demande.id_expediteur !== expediteur.id_expediteur) throw AppError.forbidden('Accès refusé à cette demande');
      if (demande.statut === 'validee') throw AppError.conflict('Cette demande est déjà payée');
      if (demande.statut !== 'verifiee') {
        throw new AppError(STATUT_MESSAGE[demande.statut] || `Paiement impossible (statut : ${demande.statut})`, 409, 'PAIEMENT_NON_DISPONIBLE');
      }
      if (await executionRepository.isPaymentOverdue(conn, id_demande, delay)) {
        throw new AppError('Délai de paiement dépassé : la demande est annulée', 409, 'PAIEMENT_DELAI_DEPASSE');
      }
      if (!(Number(demande.frais_definitifs) > 0)) throw new AppError('Aucun montant à payer pour cette demande', 409, 'MONTANT_INVALIDE');

      const simulation = simulatePayment(payload);
      const id_paiement = await paiementRepository.create(conn, {
        id_demande,
        montant: demande.frais_definitifs, // R41 : le montant du paiement égale les frais définitifs
        mode_paiement: payload.mode_paiement,
        reference_paiement: newReference(),
        ...simulation.masked,
      });

      if (simulation.ok) {
        await paiementRepository.markValid(conn, id_paiement, `REC-${new Date().getFullYear()}-${String(id_paiement).padStart(6, '0')}`);
        await executionRepository.markDemandeValidee(conn, id_demande);
        const livreur = await executionRepository.findAcceptedLivreurAccount(conn, id_demande);
        if (livreur) {
          await notificationService.notifyAccount(conn, {
            id_compte: livreur.id_compte, type: 'paiement_valide',
            libelle: `Paiement validé pour ${demande.numero_suivi} : vous pouvez récupérer le colis`, id_livraison: livreur.id_livraison,
          });
        }
      } else {
        await paiementRepository.markFailed(conn, id_paiement, simulation.motif);
      }
      // Aucune donnée de carte dans l'audit : seulement le mode et le résultat
      await auditService.log(
        {
          id_compte: user.id_compte, action: 'paiement', type_objet: 'demande', id_objet: id_demande,
          details: `${demande.numero_suivi}, mode=${payload.mode_paiement}, ${simulation.ok ? 'valide' : 'echoue'}`,
        },
        conn
      );
      return { id_paiement, ok: simulation.ok, numero_suivi: demande.numero_suivi };
    });
  } catch (err) {
    // Délai dépassé mais pas encore traité par la tâche planifiée : on annule la demande maintenant
    if (err.code === 'PAIEMENT_DELAI_DEPASSE') await expireUnpaid(id_demande);
    throw err;
  }

  const paiement = await paiementRepository.findById(outcome.id_paiement);
  const result = { ok: outcome.ok, paiement };
  if (outcome.ok) {
    result.recu = {
      numero_recu: paiement.numero_recu,
      reference_paiement: paiement.reference_paiement,
      date_paiement: paiement.date_paiement,
      numero_suivi: outcome.numero_suivi,
      expediteur: expediteur.nom_complet,
      montant: paiement.montant,
      mode_paiement: paiement.mode_paiement,
    };
  }
  return result;
};

// Récapitulatif et historique des tentatives de paiement d'une demande
const listByDemande = async (user, id_demande) => {
  const demande = await executionRepository.findDemandeSummary(id_demande);
  if (!demande) throw AppError.notFound('Demande introuvable');
  if (user.role === 'expediteur') {
    const expediteur = await getExpediteur(user);
    if (demande.id_expediteur !== expediteur.id_expediteur) throw AppError.forbidden('Accès refusé à cette demande');
  }
  const delay = await parametreService.getInt('delai_paiement_min');
  return {
    id_demande,
    numero_suivi: demande.numero_suivi,
    statut: demande.statut,
    frais_estimes: demande.frais_estimes,
    frais_definitifs: demande.frais_definitifs,
    delai_paiement_min: delay,
    paiement_avant: demande.statut === 'verifiee' ? await executionRepository.findPaymentDeadline(id_demande, delay) : null,
    tentatives: await paiementRepository.findByDemande(id_demande),
  };
};

// Demande vérifiée non payée dans le délai : annulation automatique, mêmes effets qu'une annulation par l'expéditeur
const expireUnpaid = async (id_demande) => {
  const delay = await parametreService.getInt('delai_paiement_min');
  return withTransaction(async (conn) => {
    const demande = await demandeRepository.findByIdForUpdate(conn, id_demande);
    if (!demande || demande.statut !== 'verifiee') return false;
    if (!(await executionRepository.isPaymentOverdue(conn, id_demande, delay))) return false;

    const livreur = await executionRepository.findAcceptedLivreurAccount(conn, id_demande);
    const owner = await executionRepository.findOwnerCompte(conn, id_demande);
    await demandeService.cancelWithEffects(conn, { demande, id_compte: null, motif: 'Délai de paiement dépassé' });
    await auditService.log({ id_compte: null, action: 'annulation_auto', type_objet: 'demande', id_objet: id_demande, details: `${demande.numero_suivi} : délai de paiement dépassé` }, conn);
    await notificationService.notifyAccount(conn, {
      id_compte: owner, type: 'demande_annulee',
      libelle: `Votre demande ${demande.numero_suivi} a été annulée : le paiement n'a pas été effectué dans le délai (${ar(demande.frais_definitifs)})`,
      id_livraison: livreur ? livreur.id_livraison : null,
    });
    if (livreur) {
      await notificationService.notifyAccount(conn, {
        id_compte: livreur.id_compte, type: 'mission_annulee',
        libelle: `La mission ${demande.numero_suivi} est annulée : l'expéditeur n'a pas payé dans le délai`, id_livraison: livreur.id_livraison,
      });
    }
    return true;
  });
};

// Appelé régulièrement par la tâche planifiée ; renvoie le nombre de demandes annulées
const expireUnpaidOverdue = async () => {
  const ids = await executionRepository.findUnpaidOverdueIds(await parametreService.getInt('delai_paiement_min'));
  let cancelled = 0;
  for (const id of ids) {
    try {
      if (await expireUnpaid(id)) cancelled += 1;
    } catch (err) {
      console.error(`Annulation automatique de la demande ${id} impossible :`, err.message);
    }
  }
  return cancelled;
};

module.exports = { pay, listByDemande, expireUnpaid, expireUnpaidOverdue };