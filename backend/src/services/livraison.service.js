const AppError = require('../utils/AppError');
const { getPagination, buildMeta } = require('../utils/pagination');
const livraisonRepository = require('../repositories/livraison.repository');
const affectationRepository = require('../repositories/affectation.repository');
const colisRepository = require('../repositories/colis.repository');
const destinataireRepository = require('../repositories/destinataire.repository');
const alerteRepository = require('../repositories/alerte.repository');
const parametreService = require('./parametre.service');

const list = async (query) => {
  const pagination = getPagination(query);
  const { items, total } = await livraisonRepository.list(query, pagination);
  return { items, meta: buildMeta(pagination, total) };
};

// CU-12 : détail d'une livraison pour le suivi et la réaffectation
const getById = async (id) => {
  const ctx = await livraisonRepository.findContext(id);
  if (!ctx) throw AppError.notFound('Livraison introuvable');

  const delay = await parametreService.getInt('delai_reponse_livreur_min');
  const [colis, destinataires, affectations, historique, alertes] = await Promise.all([
    colisRepository.findByDemande(ctx.id_demande),
    destinataireRepository.findByDemande(ctx.id_demande),
    affectationRepository.listByLivraison(id, delay),
    livraisonRepository.findHistorique(id),
    alerteRepository.findByLivraison(id),
  ]);

  return {
    id_livraison: ctx.id_livraison,
    statut: ctx.statut,
    date_affectation: ctx.date_affectation,
    date_debut: ctx.date_debut,
    date_fin: ctx.date_fin,
    motif_inachevement: ctx.motif_inachevement,
    date_reprogrammation: ctx.date_reprogrammation,
    demande: {
      id_demande: ctx.id_demande,
      numero_suivi: ctx.numero_suivi,
      statut: ctx.statut_demande,
      adresse_recuperation: ctx.adresse_recuperation,
      latitude_recuperation: ctx.latitude_recuperation,
      longitude_recuperation: ctx.longitude_recuperation,
      adresse_livraison: ctx.adresse_livraison,
      latitude_livraison: ctx.latitude_livraison,
      longitude_livraison: ctx.longitude_livraison,
      distance_estimee: ctx.distance_estimee,
      poids_total: ctx.poids_total,
    },
    expediteur: { nom_complet: ctx.expediteur_nom, telephone: ctx.expediteur_telephone },
    colis,
    destinataires,
    affectations,
    historique,
    alertes,
  };
};

module.exports = { list, getById };