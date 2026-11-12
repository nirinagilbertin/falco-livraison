const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { computeFees } = require('../utils/pricing');
const demandeRepository = require('../repositories/demande.repository');
const livraisonRepository = require('../repositories/livraison.repository');
const affectationRepository = require('../repositories/affectation.repository');
const executionRepository = require('../repositories/execution.repository');
const colisRepository = require('../repositories/colis.repository');
const profilRepository = require('../repositories/profil.repository');
const parametreService = require('./parametre.service');
const tarifService = require('./tarif.service');
const livraisonService = require('./livraison.service');
const notificationService = require('./notification.service');
const alerteService = require('./alerte.service');
const auditService = require('./audit.service');

const round2 = (n) => Math.round(n * 100) / 100;
const ar = (n) => `${new Intl.NumberFormat('fr-FR').format(n)} Ar`;
const pad = (n) => String(n).padStart(2, '0');

const MOTIFS_ECHEC = {
  verification_echouee: 'Vérification du destinataire échouée',
  destinataire_absent: 'Destinataire absent',
  autre: 'Autre motif',
};

const fieldError = (field, message) => new AppError('Données invalides', 400, 'VALIDATION_ERROR', [{ in: 'body', field, message }]);

const getLivreurProfil = async (user) => {
  const profil = await profilRepository.findByCompte('livreur', user.id_compte);
  if (!profil) throw AppError.forbidden('Réservé aux livreurs');
  return profil;
};

const loadContext = async (id_livraison) => {
  const ctx = await executionRepository.findContext(id_livraison);
  if (!ctx) throw AppError.notFound('Livraison introuvable');
  return ctx;
};

// Verrous pris dans le même ordre par toutes les opérations (demande, livraison, proposition acceptée, puis livreur et
// véhicule) : pas d'interblocage, et toutes les données qui évoluent sont relues sous verrou.
const lockExecution = async (conn, ctx) => {
  const demande = await demandeRepository.findByIdForUpdate(conn, ctx.id_demande);
  const livraison = await executionRepository.lockLivraison(conn, ctx.id_livraison);
  const aff = await executionRepository.findAcceptedAffectationForUpdate(conn, ctx.id_livraison);
  return { demande, livraison, aff };
};

const assertAssignedTo = (aff, livreur) => {
  if (!aff || aff.id_livreur !== livreur.id_livreur) throw AppError.forbidden('Cette livraison ne vous est pas affectée');
};

// R15 : un changement de tarif ne touche pas les demandes déjà créées. La demande ne mémorise pas son tarif ; les tarifs
// n'étant jamais modifiés, on retrouve celui qui reproduit exactement les frais estimés de la demande.
const tarifOfDemande = async (demande, poidsEstimeTotal) => {
  const candidates = await executionRepository.findTariffsCreatedBefore(demande.date_creation);
  const target = Math.round(Number(demande.frais_estimes) * 100);
  const match = candidates.find((t) => Math.round(computeFees(t, demande.distance_estimee, poidsEstimeTotal) * 100) === target);
  return match || tarifService.getActiveOrFail();
};

// Prochain jour commun (1 = lundi ... 7 = dimanche), toujours dans le futur ; format AAAA-MM-JJ
const nextCommonDay = (isoWeekday, from = new Date()) => {
  const today = ((from.getDay() + 6) % 7) + 1;
  const diff = (isoWeekday - today + 7) % 7 || 7;
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + diff);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// CU-14 : vérification du colis chez l'expéditeur. Recalcule les frais avec le poids réel ;
// la demande passe « Vérifiée ». Une correction reste possible tant que l'expéditeur n'a pas payé.
const verify = async (user, id_livraison, input) => {
  const livreur = await getLivreurProfil(user);
  const ctx = await loadContext(id_livraison);
  const delay = await parametreService.getInt('delai_paiement_min');

  const result = await withTransaction(async (conn) => {
    const { demande, livraison, aff } = await lockExecution(conn, ctx);
    assertAssignedTo(aff, livreur);
    if (livraison.statut !== 'affectee') throw AppError.conflict(`La livraison n'est pas à l'étape de vérification (statut : ${livraison.statut})`);
    if (aff.type_recuperation !== 'expediteur') throw AppError.conflict('Les colis repris au dépôt ne sont pas vérifiés à nouveau');
    if (!['en_cours', 'verifiee'].includes(demande.statut)) {
      throw AppError.conflict(`La demande ne peut plus être vérifiée (statut : ${demande.statut})`);
    }

    const colis = await executionRepository.findColisForUpdate(conn, ctx.id_demande);
    const ids = input.colis.map((c) => c.id_colis);
    if (new Set(ids).size !== ids.length) throw fieldError('colis', 'Un colis est indiqué plusieurs fois');
    const known = new Set(colis.map((c) => c.id_colis));
    if (ids.length !== colis.length || ids.some((id) => !known.has(id))) {
      throw fieldError('colis', `Tous les colis de la demande doivent être vérifiés (${colis.length} attendu(s))`);
    }

    const poidsReel = round2(input.colis.reduce((sum, c) => sum + c.poids_reel, 0));
    if (poidsReel > Number(aff.capacite_poids)) {
      throw new AppError(
        `Le poids réel total (${poidsReel} kg) dépasse la capacité du véhicule (${aff.capacite_poids} kg) : signalez le problème`,
        409,
        'CAPACITE_DEPASSEE'
      );
    }

    const poidsEstime = round2(colis.reduce((sum, c) => sum + Number(c.poids_estime), 0));
    const tarif = await tarifOfDemande(demande, poidsEstime);
    const frais_definitifs = computeFees(tarif, demande.distance_estimee, poidsReel);

    for (const c of input.colis) await executionRepository.updateColisVerification(conn, c.id_colis, c);
    await executionRepository.markDemandeVerifiee(conn, ctx.id_demande, frais_definitifs);
    await auditService.log(
      { id_compte: user.id_compte, action: 'verification', type_objet: 'demande', id_objet: ctx.id_demande, details: `${ctx.numero_suivi}, poids=${poidsReel} kg, frais=${frais_definitifs}` },
      conn
    );
    await notificationService.notifyAccount(conn, {
      id_compte: ctx.expediteur_id_compte,
      type: 'colis_verifie',
      libelle: `Colis vérifié (${ctx.numero_suivi}) : montant définitif ${ar(frais_definitifs)}, à payer dans les ${delay} minutes`,
      id_livraison,
    });
    return { frais_estimes: Number(demande.frais_estimes), frais_definitifs, poids_estime_total: poidsEstime, poids_reel_total: poidsReel };
  });

  return {
    id_livraison,
    id_demande: ctx.id_demande,
    numero_suivi: ctx.numero_suivi,
    statut_demande: 'verifiee',
    ...result,
    delai_paiement_min: delay,
    paiement_avant: await executionRepository.findPaymentDeadline(ctx.id_demande, delay),
    colis: await colisRepository.findByDemande(ctx.id_demande),
  };
};

// CU-14 : le livreur récupère le colis (chez l'expéditeur, ou au dépôt lors de la redistribution)
const pickup = async (user, id_livraison) => {
  const livreur = await getLivreurProfil(user);
  const ctx = await loadContext(id_livraison);

  await withTransaction(async (conn) => {
    const { demande, livraison, aff } = await lockExecution(conn, ctx);
    assertAssignedTo(aff, livreur);
    if (livraison.statut !== 'affectee') throw AppError.conflict(`La livraison n'est pas prête pour la récupération (statut : ${livraison.statut})`);
    if (demande.statut === 'en_cours') throw new AppError("Le colis n'a pas encore été vérifié", 409, 'VERIFICATION_REQUISE');
    if (demande.statut === 'verifiee') throw new AppError("Le paiement de l'expéditeur n'est pas encore validé", 409, 'PAIEMENT_REQUIS');
    if (demande.statut !== 'validee') throw AppError.conflict(`La demande ne permet pas la récupération (statut : ${demande.statut})`);

    await executionRepository.markColisRecupere(conn, ctx.id_demande);
    await executionRepository.markLivraisonEnCours(conn, id_livraison);
    await livraisonRepository.insertHistorique(conn, {
      id_livraison, ancien_statut: 'affectee', nouveau_statut: 'en_cours', id_compte: user.id_compte,
      motif: aff.type_recuperation === 'depot' ? 'Colis repris au dépôt' : "Colis récupéré chez l'expéditeur",
    });
    await auditService.log({ id_compte: user.id_compte, action: 'recuperation', type_objet: 'livraison', id_objet: id_livraison, details: ctx.numero_suivi }, conn);
    await notificationService.notifyAccount(conn, {
      id_compte: ctx.expediteur_id_compte, type: 'changement_statut', libelle: `Votre colis (${ctx.numero_suivi}) est en cours de livraison`, id_livraison,
    });
  });
  return livraisonService.getById(id_livraison);
};

// CU-16 : remise du colis. Le livreur a vérifié la personne en face à face (CIN ou téléphone) ;
// le CIN du destinataire n'est jamais enregistré, seuls la personne et la méthode le sont (R29).
const deliver = async (user, id_livraison, { id_destinataire, methode_verification }) => {
  const livreur = await getLivreurProfil(user);
  const ctx = await loadContext(id_livraison);
  const destinataire = await executionRepository.findDestinataire(id_destinataire, ctx.id_demande);
  if (!destinataire) throw fieldError('id_destinataire', "Cette personne n'est pas un destinataire de cette demande");

  await withTransaction(async (conn) => {
    const { livraison, aff } = await lockExecution(conn, ctx);
    assertAssignedTo(aff, livreur);
    if (livraison.statut !== 'en_cours') throw AppError.conflict(`La livraison n'est pas en cours (statut : ${livraison.statut})`);

    await executionRepository.markLivraisonTerminee(conn, { id_livraison, id_destinataire, methode_verification });
    await executionRepository.markColisLivre(conn, ctx.id_demande);
    await affectationRepository.releaseLivreurAndVehicule(conn, { id_livreur: aff.id_livreur, id_vehicule: aff.id_vehicule });
    await livraisonRepository.insertHistorique(conn, {
      id_livraison, ancien_statut: 'en_cours', nouveau_statut: 'terminee', id_compte: user.id_compte,
      motif: `Colis remis à ${destinataire.prenom ? `${destinataire.prenom} ` : ''}${destinataire.nom} (vérification : ${methode_verification})`,
    });
    await auditService.log({ id_compte: user.id_compte, action: 'remise', type_objet: 'livraison', id_objet: id_livraison, details: ctx.numero_suivi }, conn);
    await notificationService.notifyAccount(conn, {
      id_compte: ctx.expediteur_id_compte, type: 'changement_statut', libelle: `Votre colis (${ctx.numero_suivi}) a été livré`, id_livraison,
    });
  });
  return livraisonService.getById(id_livraison);
};

// CU-16, A1/A2 : vérification échouée ou destinataire absent. La livraison devient « Inachevée » ;
// le livreur ramène le colis au dépôt et reste occupé jusqu'à la confirmation du gestionnaire.
const fail = async (user, id_livraison, { motif_type, detail }) => {
  const livreur = await getLivreurProfil(user);
  const ctx = await loadContext(id_livraison);
  const motif = `${MOTIFS_ECHEC[motif_type]}${detail ? ` : ${detail}` : ''}`.slice(0, 255);

  await withTransaction(async (conn) => {
    const { livraison, aff } = await lockExecution(conn, ctx);
    assertAssignedTo(aff, livreur);
    if (livraison.statut !== 'en_cours') throw AppError.conflict(`La livraison n'est pas en cours (statut : ${livraison.statut})`);

    await executionRepository.markLivraisonInachevee(conn, { id_livraison, motif });
    await livraisonRepository.insertHistorique(conn, {
      id_livraison, ancien_statut: 'en_cours', nouveau_statut: 'inachevee', id_compte: user.id_compte, motif,
    });
    await auditService.log({ id_compte: user.id_compte, action: 'echec_livraison', type_objet: 'livraison', id_objet: id_livraison, details: `${ctx.numero_suivi} : ${motif}` }, conn);
    await alerteService.raise(conn, {
      id_livraison,
      type_alerte: 'livraison_inachevee',
      libelle: `Livraison ${ctx.numero_suivi} inachevée : ${motif}`,
      niveau_priorite: 'moyen',
      notifier: ['gestionnaire', 'superviseur'],
    });
    await notificationService.notifyAccount(conn, {
      id_compte: ctx.expediteur_id_compte, type: 'changement_statut',
      libelle: `Votre livraison ${ctx.numero_suivi} n'a pas pu être remise (${MOTIFS_ECHEC[motif_type].toLowerCase()}) : le colis est ramené au dépôt`,
      id_livraison,
    });
  });
  return livraisonService.getById(id_livraison);
};

// CU-13 : le gestionnaire confirme que le colis est au dépôt (colis « Déposé »), le livreur redevient libre
const confirmDeposit = async (user, id_livraison, id_depot) => {
  const ctx = await loadContext(id_livraison);
  const depotId = id_depot || ctx.id_depot_zone;
  const depot = await executionRepository.findDepot(depotId);
  if (!depot) throw fieldError('id_depot', 'Dépôt introuvable');
  if (id_depot && depot.statut !== 'actif') throw fieldError('id_depot', 'Ce dépôt est inactif');

  const manager = await profilRepository.findByCompte(user.role, user.id_compte);
  const jourCommun = await parametreService.getInt('jour_livraison_commune');
  const reprogrammation = nextCommonDay(jourCommun);

  await withTransaction(async (conn) => {
    const { livraison, aff } = await lockExecution(conn, ctx);
    if (livraison.statut !== 'inachevee') throw AppError.conflict(`Seule une livraison inachevée peut être déposée (statut : ${livraison.statut})`);

    const deposited = await executionRepository.markColisDepose(conn, ctx.id_demande, {
      id_depot: depot.id_depot, id_utilisateur: manager ? manager.id_utilisateur : null,
    });
    if (deposited === 0) throw AppError.conflict('Aucun colis à déposer : le dépôt a peut-être déjà été confirmé');

    if (aff) await affectationRepository.releaseLivreurAndVehicule(conn, { id_livreur: aff.id_livreur, id_vehicule: aff.id_vehicule });
    await executionRepository.setReprogrammation(conn, id_livraison, reprogrammation);
    await auditService.log(
      { id_compte: user.id_compte, action: 'depot', type_objet: 'livraison', id_objet: id_livraison, details: `${ctx.numero_suivi} -> ${depot.nom}` },
      conn
    );
    await notificationService.notifyAccount(conn, {
      id_compte: ctx.expediteur_id_compte, type: 'changement_statut',
      libelle: `Votre colis (${ctx.numero_suivi}) est au dépôt ; nouvelle tentative de livraison prévue le ${reprogrammation}`,
      id_livraison,
    });
  });
  return livraisonService.getById(id_livraison);
};

module.exports = { verify, pickup, deliver, fail, confirmDeposit, nextCommonDay };