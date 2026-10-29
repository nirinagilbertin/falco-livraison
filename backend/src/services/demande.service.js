const crypto = require('crypto');
const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { getPagination, buildMeta } = require('../utils/pagination');
const { haversineKm } = require('../utils/geo');
const { computeFees } = require('../utils/pricing');
const demandeRepository = require('../repositories/demande.repository');
const colisRepository = require('../repositories/colis.repository');
const destinataireRepository = require('../repositories/destinataire.repository');
const livraisonRepository = require('../repositories/livraison.repository');
const affectationRepository = require('../repositories/affectation.repository');
const profilRepository = require('../repositories/profil.repository');
const zoningService = require('./zoning.service');
const tarifService = require('./tarif.service');
const auditService = require('./audit.service');

const SUBJECT = 'demande';
const round2 = (n) => Math.round(n * 100) / 100;

const fieldError = (field, message) =>
  new AppError('Données invalides', 400, 'VALIDATION_ERROR', [{ in: 'body', field, message }]);

// Profil expéditeur du compte connecté
const getExpediteur = async (user) => {
  const profil = await profilRepository.findByCompte('expediteur', user.id_compte);
  if (!profil) throw AppError.forbidden('Réservé aux expéditeurs');
  return profil;
};

const buildDetail = async (id) => {
  const row = await demandeRepository.findById(id);
  if (!row) throw AppError.notFound('Demande introuvable');

  const [colis, destinataires, livraison] = await Promise.all([
    colisRepository.findByDemande(id),
    destinataireRepository.findByDemande(id),
    livraisonRepository.findByDemande(id),
  ]);
  const historique = livraison ? await livraisonRepository.findHistorique(livraison.id_livraison) : [];

  const { type_expediteur, expediteur_nom, expediteur_telephone, nom_zone, ville, ...demande } = row;
  return {
    ...demande,
    poids_total_estime: round2(colis.reduce((sum, c) => sum + Number(c.poids_estime), 0)),
    expediteur: {
      id_expediteur: demande.id_expediteur,
      type_expediteur,
      nom_complet: expediteur_nom,
      telephone: expediteur_telephone,
    },
    zone_recuperation: { id_zone: demande.id_zone_recuperation, nom_zone, ville },
    colis,
    destinataires,
    livraison,
    historique,
  };
};

// Un expéditeur ne voit que ses demandes ; les rôles internes voient toutes les demandes
const list = async (user, query) => {
  const filters = { ...query };
  if (user.role === 'expediteur') filters.id_expediteur = (await getExpediteur(user)).id_expediteur;

  const pagination = getPagination(query);
  const { items, total } = await demandeRepository.list(filters, pagination);
  return { items, meta: buildMeta(pagination, total) };
};

const getById = async (user, id) => {
  const detail = await buildDetail(id);
  if (user.role === 'expediteur') {
    const expediteur = await getExpediteur(user);
    if (detail.id_expediteur !== expediteur.id_expediteur) throw AppError.forbidden('Accès refusé à cette demande');
  }
  return detail;
};

// CU-05 : création d'une demande (une seule livraison, un ou plusieurs colis, jamais de livraison partielle)
const create = async (user, data) => {
  const expediteur = await getExpediteur(user);

  // Les deux adresses doivent se trouver dans une zone desservie (R13)
  const zoneRecuperation = await zoningService.locate(data.latitude_recuperation, data.longitude_recuperation);
  if (!zoneRecuperation) throw fieldError('adresse_recuperation', "L'adresse de récupération est hors des zones desservies");
  const zoneLivraison = await zoningService.locate(data.latitude_livraison, data.longitude_livraison);
  if (!zoneLivraison) throw fieldError('adresse_livraison', "L'adresse de livraison est hors des zones desservies");

  // Distance à vol d'oiseau pour l'instant ; le calcul d'itinéraire viendra avec la géolocalisation
  const distance = round2(
    haversineKm(data.latitude_recuperation, data.longitude_recuperation, data.latitude_livraison, data.longitude_livraison)
  );
  const poidsTotal = round2(data.colis.reduce((sum, c) => sum + c.poids_estime, 0));
  const tarif = await tarifService.getActiveOrFail();
  const frais_estimes = computeFees(tarif, distance, poidsTotal);

  // Un seul destinataire principal : le premier si aucun n'est désigné
  const hasPrincipal = data.destinataires.some((d) => d.est_principal);
  const destinataires = data.destinataires.map((d, i) => ({ ...d, est_principal: hasPrincipal ? Boolean(d.est_principal) : i === 0 }));

  const id = await withTransaction(async (conn) => {
    const id_demande = await demandeRepository.create(conn, {
      numero_suivi: `TMP${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
      id_expediteur: expediteur.id_expediteur,
      adresse_recuperation: data.adresse_recuperation,
      latitude_recuperation: data.latitude_recuperation,
      longitude_recuperation: data.longitude_recuperation,
      id_zone_recuperation: zoneRecuperation.id_zone,
      adresse_livraison: data.adresse_livraison,
      latitude_livraison: data.latitude_livraison,
      longitude_livraison: data.longitude_livraison,
      distance_estimee: distance,
      frais_estimes,
    });
    const numero_suivi = `FAL-${new Date().getFullYear()}-${String(id_demande).padStart(6, '0')}`;
    await demandeRepository.setNumeroSuivi(conn, id_demande, numero_suivi);

    await colisRepository.createMany(conn, id_demande, data.colis);
    await destinataireRepository.createMany(conn, id_demande, destinataires);

    // Une demande = exactement une livraison, créée avec elle (R18)
    const id_livraison = await livraisonRepository.create(conn, id_demande);
    await livraisonRepository.insertHistorique(conn, {
      id_livraison, nouveau_statut: 'en_attente', id_compte: user.id_compte, motif: 'Création de la demande',
    });

    await auditService.log(
      { id_compte: user.id_compte, action: 'creation', type_objet: SUBJECT, id_objet: id_demande, details: `${numero_suivi}, frais=${frais_estimes}` },
      conn
    );
    return id_demande;
  });

  // Étape 8 : c'est ici que la recherche d'un livreur sera lancée (CU-11), après la validation de la transaction.
  return buildDetail(id);
};

// Annulation avec tous ses effets (CU-07) : réutilisable par l'annulation automatique (délai de paiement dépassé)
// id_compte = null signifie que l'annulation est faite par le système.
const cancelWithEffects = async (conn, { demande, id_compte = null, motif = null }) => {
  const livraison = await livraisonRepository.findByDemande(demande.id_demande, conn);

  await demandeRepository.markCancelled(conn, demande.id_demande, motif);
  await demandeRepository.cancelPendingPayments(conn, demande.id_demande);

  if (livraison) {
    // Propositions en cours annulées ; le livreur affecté redevient libre et son véhicule disponible
    const open = await affectationRepository.findOpenByLivraison(conn, livraison.id_livraison);
    await affectationRepository.cancelOpen(conn, livraison.id_livraison);
    for (const a of open.filter((x) => x.statut === 'acceptee')) {
      await affectationRepository.releaseLivreurAndVehicule(conn, { id_livreur: a.id_livreur, id_vehicule: a.id_vehicule });
    }

    await livraisonRepository.updateStatut(conn, livraison.id_livraison, 'annulee');
    await livraisonRepository.insertHistorique(conn, {
      id_livraison: livraison.id_livraison,
      ancien_statut: livraison.statut,
      nouveau_statut: 'annulee',
      id_compte,
      motif: motif || 'Demande annulée',
    });
  }
};

// CU-07 : l'expéditeur annule sa demande tant qu'elle n'est pas validée par le paiement (R17)
const cancel = async (user, id, motif) => {
  const expediteur = await getExpediteur(user);

  await withTransaction(async (conn) => {
    const demande = await demandeRepository.findByIdForUpdate(conn, id);
    if (!demande) throw AppError.notFound('Demande introuvable');
    if (demande.id_expediteur !== expediteur.id_expediteur) throw AppError.forbidden('Accès refusé à cette demande');
    if (demande.statut === 'annulee') throw AppError.conflict('Cette demande est déjà annulée');
    if (demande.statut === 'validee') throw AppError.conflict('Cette demande est déjà validée par le paiement : annulation impossible');

    await cancelWithEffects(conn, { demande, id_compte: user.id_compte, motif });
    await auditService.log(
      { id_compte: user.id_compte, action: 'annulation', type_objet: SUBJECT, id_objet: id, details: demande.numero_suivi },
      conn
    );
  });
  return buildDetail(id);
};

module.exports = { list, getById, create, cancel, cancelWithEffects };