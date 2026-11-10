const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { getPagination, buildMeta } = require('../utils/pagination');
const { haversineKm } = require('../utils/geo');
const affectationRepository = require('../repositories/affectation.repository');
const livraisonRepository = require('../repositories/livraison.repository');
const demandeRepository = require('../repositories/demande.repository');
const colisRepository = require('../repositories/colis.repository');
const destinataireRepository = require('../repositories/destinataire.repository');
const livreurRepository = require('../repositories/livreur.repository');
const profilRepository = require('../repositories/profil.repository');
const parametreService = require('./parametre.service');
const notificationService = require('./notification.service');
const alerteService = require('./alerte.service');
const auditService = require('./audit.service');

const SUBJECT = 'affectation';
const ROLES_ALERTE = ['administrateur', 'superviseur', 'gestionnaire']; // refus, absence de réponse (R22)
const round2 = (n) => Math.round(n * 100) / 100;

const getDelay = () => parametreService.getInt('delai_reponse_livreur_min');

const getLivreurProfil = async (user) => {
  const profil = await profilRepository.findByCompte('livreur', user.id_compte);
  if (!profil) throw AppError.forbidden('Réservé aux livreurs');
  return profil;
};

// Verrouille la demande d'une livraison en premier : toutes les opérations (annulation, acceptation,
// expiration...) prennent leurs verrous dans le même ordre, ce qui évite les blocages croisés.
const lockDemandeOf = async (conn, id_livraison) => {
  const ctx = await livraisonRepository.findContext(id_livraison, conn);
  if (!ctx) throw AppError.notFound('Livraison introuvable');
  await demandeRepository.findByIdForUpdate(conn, ctx.id_demande);
  return ctx;
};

// ---------- éligibilité ----------
const ineligibilityReasons = (facts, ctx) => {
  const reasons = [];
  if (facts.statut_compte !== 'actif') reasons.push('Compte suspendu');
  if (facts.mot_de_passe_temporaire) reasons.push("Le livreur n'a pas encore activé son compte (mot de passe temporaire)");
  if (facts.disponibilite !== 'libre') reasons.push(`Livreur non disponible (${facts.disponibilite})`);
  if (!facts.id_vehicule) {
    reasons.push('Aucun véhicule habituel assigné');
  } else {
    if (facts.vehicule_statut !== 'disponible') reasons.push(`Véhicule non disponible (${facts.vehicule_statut})`);
    if (Number(facts.capacite_poids) < Number(ctx.poids_total)) {
      reasons.push(`Capacité du véhicule insuffisante (${facts.capacite_poids} kg pour ${ctx.poids_total} kg)`);
    }
    if (facts.vehicule_reserve) reasons.push('Son véhicule est réservé par une proposition en attente');
  }
  if (!facts.dans_zone) reasons.push('Zone de récupération non couverte par ce livreur');
  if (facts.proposition_en_attente) reasons.push('Ce livreur a déjà une proposition en attente de réponse');
  return reasons;
};

// Classe les candidats du plus proche au plus éloigné (dernière position connue) ;
// ceux dont la position est inconnue passent après les autres.
const rankByProximity = (ctx, rows) =>
  rows
    .map((r) => {
      const known = r.derniere_latitude !== null && r.derniere_longitude !== null;
      return {
        ...r,
        distance_km: known
          ? round2(haversineKm(ctx.latitude_recuperation, ctx.longitude_recuperation, r.derniere_latitude, r.derniere_longitude))
          : null,
      };
    })
    .sort((a, b) => {
      if (a.distance_km === null && b.distance_km === null) return a.id_livreur - b.id_livreur;
      if (a.distance_km === null) return 1;
      if (b.distance_km === null) return -1;
      return a.distance_km - b.distance_km || a.id_livreur - b.id_livreur;
    });

const toCandidateDto = (r) => ({
  id_livreur: r.id_livreur,
  nom: r.nom,
  prenom: r.prenom,
  telephone: r.telephone,
  vehicule: { id_vehicule: r.id_vehicule, immatriculation: r.immatriculation, type_vehicule: r.type_vehicule, capacite_poids: r.capacite_poids },
  distance_km: r.distance_km,
  position_connue: r.distance_km !== null,
  date_derniere_position: r.date_derniere_position,
});

const findRankedCandidates = async (ctx, { excludeDeclined }) => {
  const rows = await affectationRepository.findCandidates({
    id_livraison: ctx.id_livraison,
    id_zone: ctx.id_zone_recuperation,
    poids: ctx.poids_total,
    excludeDeclined,
  });
  return rankByProximity(ctx, rows);
};

// Livreurs éligibles pour une livraison en attente (le gestionnaire choisit parmi eux)
const listEligible = async (id_livraison) => {
  const ctx = await livraisonRepository.findContext(id_livraison);
  if (!ctx) throw AppError.notFound('Livraison introuvable');
  if (ctx.statut !== 'en_attente') throw AppError.conflict(`La livraison n'est pas en attente (statut : ${ctx.statut})`);
  return (await findRankedCandidates(ctx, { excludeDeclined: false })).map(toCandidateDto);
};

// ---------- proposition ----------
// Crée la proposition de mission dans une transaction qui revérifie tout après avoir verrouillé les lignes
const createProposal = (ctx, livreur, { proposant = null, user = null, manual = false, type_recuperation = 'expediteur' }) =>
  withTransaction(async (conn) => {
    await demandeRepository.findByIdForUpdate(conn, ctx.id_demande);
    const livraison = await livraisonRepository.findByIdForUpdate(conn, ctx.id_livraison);
    if (!livraison || livraison.statut !== 'en_attente') {
      throw new AppError("La livraison n'est plus en attente", 409, 'LIVRAISON_NON_EN_ATTENTE');
    }

    // Verrous du livreur puis de son véhicule AVANT toute lecture simple : sous REPEATABLE READ, la première
    // lecture simple fige l'instantané. Prise après les verrous, elle voit les propositions validées entre-temps
    // (évite deux propositions simultanées au même livreur, ou à deux livreurs partageant un véhicule).
    const locked = await affectationRepository.lockLivreur(conn, livreur.id_livreur);
    if (locked && locked.id_vehicule) await affectationRepository.lockVehicule(conn, locked.id_vehicule);

    if ((await affectationRepository.findPendingByLivraison(conn, ctx.id_livraison)).length > 0) {
      throw new AppError('Une proposition est déjà en attente de réponse pour cette livraison', 409, 'PROPOSITION_EN_ATTENTE');
    }

    const facts = await affectationRepository.findEligibilityFacts(conn, livreur.id_livreur, ctx.id_zone_recuperation);
    const reasons = ineligibilityReasons(facts, ctx);
    if (reasons.length > 0) throw new AppError('Ce livreur ne peut pas recevoir la mission', 409, 'NOT_ELIGIBLE', reasons);

    const id_affectation = await affectationRepository.create(conn, {
      id_livraison: ctx.id_livraison,
      id_livreur: livreur.id_livreur,
      id_vehicule: facts.id_vehicule, // copie figée du véhicule du livreur (R35)
      id_utilisateur_proposant: proposant,
      type_recuperation,
    });
    await auditService.log(
      {
        id_compte: user ? user.id_compte : null, action: 'proposition', type_objet: SUBJECT, id_objet: id_affectation,
        details: `${ctx.numero_suivi} -> livreur ${livreur.id_livreur} (${manual ? 'manuelle' : 'automatique'})`,
      },
      conn
    );
    await notificationService.notifyAccount(conn, {
      id_compte: livreur.id_compte,
      type: 'mission_proposee',
      libelle: `Nouvelle mission ${ctx.numero_suivi} : récupération à ${ctx.adresse_recuperation}`,
      id_livraison: ctx.id_livraison,
    });
    return id_affectation;
  });

// CU-11 : recherche du livreur éligible le plus proche et proposition de la mission.
// Sans livreur, une alerte est créée et le superviseur est notifié (R23).
const autoAssign = async (id_livraison, { user = null } = {}) => {
  const ctx = await livraisonRepository.findContext(id_livraison);
  if (!ctx) throw AppError.notFound('Livraison introuvable');
  if (ctx.statut !== 'en_attente') return { proposed: false, reason: 'LIVRAISON_NON_EN_ATTENTE' };

  const candidates = await findRankedCandidates(ctx, { excludeDeclined: true });
  for (const candidate of candidates) {
    try {
      const id_affectation = await createProposal(ctx, candidate, { user });
      return { proposed: true, id_affectation, id_livreur: candidate.id_livreur, distance_km: candidate.distance_km };
    } catch (err) {
      if (err.code === 'NOT_ELIGIBLE') continue; // un autre traitement l'a pris entre-temps : candidat suivant
      if (err.code === 'PROPOSITION_EN_ATTENTE' || err.code === 'LIVRAISON_NON_EN_ATTENTE') return { proposed: false, reason: err.code };
      throw err;
    }
  }

  await withTransaction((conn) =>
    alerteService.raise(conn, {
      id_livraison,
      type_alerte: 'aucun_livreur',
      libelle: `Aucun livreur disponible pour la livraison ${ctx.numero_suivi}`,
      niveau_priorite: 'eleve',
      notifier: ['superviseur'],
      dedupe: true,
    })
  );
  return { proposed: false, reason: 'AUCUN_LIVREUR' };
};

// Le gestionnaire relance la recherche automatique (par exemple après « aucun livreur disponible »)
const retrySearch = async (user, id_livraison) => {
  const ctx = await livraisonRepository.findContext(id_livraison);
  if (!ctx) throw AppError.notFound('Livraison introuvable');
  if (ctx.statut !== 'en_attente') throw AppError.conflict(`La livraison n'est pas en attente (statut : ${ctx.statut})`);
  const pending = await affectationRepository.findPendingByLivraison(null, id_livraison);
  if (pending.length > 0) throw new AppError('Une proposition est déjà en attente de réponse pour cette livraison', 409, 'PROPOSITION_EN_ATTENTE');
  return autoAssign(id_livraison, { user });
};

// CU-11, A3 : le gestionnaire choisit lui-même un livreur et le système lui propose la mission
const assignManually = async (user, id_livraison, id_livreur) => {
  const ctx = await livraisonRepository.findContext(id_livraison);
  if (!ctx) throw AppError.notFound('Livraison introuvable');
  if (ctx.statut !== 'en_attente') throw AppError.conflict(`La livraison n'est pas en attente (statut : ${ctx.statut})`);
  const livreur = await livreurRepository.findById(id_livreur);
  if (!livreur) throw AppError.notFound('Livreur introuvable');

  const proposant = await profilRepository.findByCompte(user.role, user.id_compte);
  const id_affectation = await createProposal(ctx, livreur, {
    proposant: proposant ? proposant.id_utilisateur : null, user, manual: true,
  });
  return getDetail(user, id_affectation);
};

// ---------- réponse du livreur ----------
const STATUT_LABEL = { acceptee: 'déjà acceptée', refusee: 'déjà refusée', expiree: 'expirée', annulee: 'annulée' };

// Un livreur ne traite qu'une livraison à la fois (R30) : tout est revérifié sous verrou
const accept = async (user, id) => {
  const livreurProfil = await getLivreurProfil(user);
  const delay = await getDelay();

  try {
    await withTransaction(async (conn) => {
      const first = await affectationRepository.findById(id, delay, conn);
      if (!first) throw AppError.notFound('Proposition introuvable');
      if (first.id_livreur !== livreurProfil.id_livreur) throw AppError.forbidden('Cette proposition ne vous est pas adressée');

      const ctx = await lockDemandeOf(conn, first.id_livraison);
      const aff = await affectationRepository.findByIdForUpdate(conn, id, delay);
      if (aff.statut !== 'en_attente') throw AppError.conflict(`Cette proposition est ${STATUT_LABEL[aff.statut] || aff.statut}`);
      if (aff.depassee) throw new AppError('Cette proposition a expiré', 409, 'PROPOSITION_EXPIREE');

      const livraison = await livraisonRepository.findByIdForUpdate(conn, aff.id_livraison);
      if (livraison.statut !== 'en_attente') throw AppError.conflict("Cette livraison n'est plus en attente");

      const livreur = await affectationRepository.lockLivreur(conn, aff.id_livreur);
      if (livreur.disponibilite !== 'libre') throw AppError.conflict('Vous avez déjà une mission en cours');
      const vehicule = await affectationRepository.lockVehicule(conn, aff.id_vehicule);
      if (vehicule.statut !== 'disponible') throw AppError.conflict("Votre véhicule n'est plus disponible");

      await affectationRepository.setStatut(conn, id, 'acceptee');
      await livraisonRepository.markAffectee(conn, aff.id_livraison);
      // La demande passe « En cours » ; lors de la redistribution (reprise au dépôt) elle reste « Validée »
      if (aff.type_recuperation === 'expediteur') await demandeRepository.updateStatut(conn, ctx.id_demande, 'en_cours');
      await affectationRepository.occupyLivreurAndVehicule(conn, { id_livreur: aff.id_livreur, id_vehicule: aff.id_vehicule });
      await livraisonRepository.insertHistorique(conn, {
        id_livraison: aff.id_livraison, ancien_statut: 'en_attente', nouveau_statut: 'affectee', id_compte: user.id_compte, motif: 'Mission acceptée par le livreur',
      });
      await auditService.log({ id_compte: user.id_compte, action: 'acceptation', type_objet: SUBJECT, id_objet: id, details: ctx.numero_suivi }, conn);
      await notificationService.notifyAccount(conn, {
        id_compte: ctx.expediteur_id_compte,
        type: 'changement_statut',
        libelle: `Un livreur a été affecté à votre livraison ${ctx.numero_suivi}`,
        id_livraison: aff.id_livraison,
      });
    });
  } catch (err) {
    // Délai dépassé mais pas encore traité par la tâche planifiée : on l'enregistre maintenant (alerte comprise)
    if (err.code === 'PROPOSITION_EXPIREE') await expireOne(id);
    throw err;
  }
  return getDetail(user, id);
};

// R22 : un refus laisse la livraison en attente, crée une alerte et notifie les responsables
const refuse = async (user, id, motif) => {
  const livreurProfil = await getLivreurProfil(user);
  const delay = await getDelay();

  await withTransaction(async (conn) => {
    const first = await affectationRepository.findById(id, delay, conn);
    if (!first) throw AppError.notFound('Proposition introuvable');
    if (first.id_livreur !== livreurProfil.id_livreur) throw AppError.forbidden('Cette proposition ne vous est pas adressée');

    const ctx = await lockDemandeOf(conn, first.id_livraison);
    const aff = await affectationRepository.findByIdForUpdate(conn, id, delay);
    if (aff.statut !== 'en_attente') throw AppError.conflict(`Cette proposition est ${STATUT_LABEL[aff.statut] || aff.statut}`);

    await affectationRepository.setStatut(conn, id, 'refusee');
    await auditService.log({ id_compte: user.id_compte, action: 'refus', type_objet: SUBJECT, id_objet: id, details: ctx.numero_suivi }, conn);
    await alerteService.raise(conn, {
      id_livraison: aff.id_livraison,
      type_alerte: 'refus_mission',
      libelle: `Mission ${ctx.numero_suivi} refusée par ${livreurProfil.prenom} ${livreurProfil.nom}${motif ? ` : ${motif}` : ''}`,
      niveau_priorite: 'moyen',
      notifier: ROLES_ALERTE,
    });
  });
  return getDetail(user, id);
};

// ---------- expiration ----------
// Proposition sans réponse dans le délai paramétré : même traitement qu'un refus (alerte + notifications)
const expireOne = async (id) => {
  const delay = await getDelay();
  return withTransaction(async (conn) => {
    const first = await affectationRepository.findById(id, delay, conn);
    if (!first) return false;
    const ctx = await lockDemandeOf(conn, first.id_livraison);
    const aff = await affectationRepository.findByIdForUpdate(conn, id, delay);
    if (!aff || aff.statut !== 'en_attente' || !aff.depassee) return false;

    await affectationRepository.setStatut(conn, id, 'expiree');
    const livreur = await livreurRepository.findById(aff.id_livreur, conn);
    await auditService.log({ id_compte: null, action: 'expiration', type_objet: SUBJECT, id_objet: id, details: ctx.numero_suivi }, conn);
    await alerteService.raise(conn, {
      id_livraison: aff.id_livraison,
      type_alerte: 'absence_reponse',
      libelle: `Mission ${ctx.numero_suivi} : aucune réponse de ${livreur.prenom} ${livreur.nom} dans le délai`,
      niveau_priorite: 'moyen',
      notifier: ROLES_ALERTE,
    });
    await notificationService.notifyAccount(conn, {
      id_compte: livreur.id_compte, type: 'mission_expiree', libelle: `La proposition de mission ${ctx.numero_suivi} a expiré`, id_livraison: aff.id_livraison,
    });
    return true;
  });
};

// Appelé régulièrement par la tâche planifiée ; renvoie le nombre de propositions expirées
const expireOverdue = async () => {
  const ids = await affectationRepository.findOverdueIds(await getDelay());
  let expired = 0;
  for (const id of ids) {
    try {
      if (await expireOne(id)) expired += 1;
    } catch (err) {
      console.error(`Expiration de la proposition ${id} impossible :`, err.message);
    }
  }
  return expired;
};

// Annulation d'une proposition en attente par le gestionnaire (livreur injoignable, erreur de choix...)
const cancelProposal = async (user, id) => {
  const delay = await getDelay();
  await withTransaction(async (conn) => {
    const first = await affectationRepository.findById(id, delay, conn);
    if (!first) throw AppError.notFound('Proposition introuvable');
    const ctx = await lockDemandeOf(conn, first.id_livraison);
    const aff = await affectationRepository.findByIdForUpdate(conn, id, delay);
    if (aff.statut !== 'en_attente') throw AppError.conflict(`Seule une proposition en attente peut être annulée (statut : ${aff.statut})`);

    const livreur = await livreurRepository.findById(aff.id_livreur, conn);
    await affectationRepository.setStatut(conn, id, 'annulee');
    await auditService.log({ id_compte: user.id_compte, action: 'annulation', type_objet: SUBJECT, id_objet: id, details: ctx.numero_suivi }, conn);
    await notificationService.notifyAccount(conn, {
      id_compte: livreur.id_compte, type: 'mission_annulee', libelle: `La proposition de mission ${ctx.numero_suivi} a été annulée`, id_livraison: aff.id_livraison,
    });
  });
  return getDetail(user, id);
};

// ---------- consultation ----------
const listMine = async (user, query) => {
  const livreur = await getLivreurProfil(user);
  const pagination = getPagination(query);
  const { items, total } = await affectationRepository.listByLivreur(livreur.id_livreur, query, await getDelay(), pagination);
  return { items, meta: buildMeta(pagination, total) };
};

const getDetail = async (user, id) => {
  const row = await affectationRepository.findDetail(id, await getDelay());
  if (!row) throw AppError.notFound('Proposition introuvable');

  const isLivreur = user.role === 'livreur';
  if (isLivreur) {
    const livreur = await getLivreurProfil(user);
    if (row.id_livreur !== livreur.id_livreur) throw AppError.forbidden('Cette proposition ne vous est pas adressée');
  }
  // Un livreur ne voit les coordonnées de l'expéditeur et les destinataires qu'après avoir accepté la mission
  const showPrivate = !isLivreur || row.statut === 'acceptee';
  const colis = await colisRepository.findByDemande(row.id_demande);
  const destinataires = showPrivate ? await destinataireRepository.findByDemande(row.id_demande) : undefined;

  return {
    id_affectation: row.id_affectation,
    statut: row.statut,
    type_recuperation: row.type_recuperation,
    date_proposition: row.date_proposition,
    date_reponse: row.date_reponse,
    expire_le: row.expire_le,
    livreur: { id_livreur: row.id_livreur, nom: row.livreur_nom, prenom: row.livreur_prenom },
    vehicule: { id_vehicule: row.id_vehicule, immatriculation: row.immatriculation, type_vehicule: row.type_vehicule },
    livraison: { id_livraison: row.id_livraison, statut: row.statut_livraison },
    demande: {
      id_demande: row.id_demande,
      numero_suivi: row.numero_suivi,
      adresse_recuperation: row.adresse_recuperation,
      latitude_recuperation: row.latitude_recuperation,
      longitude_recuperation: row.longitude_recuperation,
      adresse_livraison: row.adresse_livraison,
      latitude_livraison: row.latitude_livraison,
      longitude_livraison: row.longitude_livraison,
      distance_estimee: row.distance_estimee,
      poids_total: row.poids_total,
    },
    expediteur: { nom_complet: row.expediteur_nom, ...(showPrivate ? { telephone: row.expediteur_telephone } : {}) },
    colis,
    ...(destinataires ? { destinataires } : {}),
  };
};

module.exports = {
  listEligible, autoAssign, retrySearch, assignManually, accept, refuse, expireOne, expireOverdue, cancelProposal, listMine, getDetail,
};