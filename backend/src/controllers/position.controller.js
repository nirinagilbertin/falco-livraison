const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const positionService = require('../services/position.service');

const share = asyncHandler(async (req, res) => success(res, await positionService.share(req.user, req.body), { message: 'Position enregistrée' }));

const list = asyncHandler(async (req, res) => success(res, await positionService.listLivreurs(req.validated.query)));

const livraisonPosition = asyncHandler(async (req, res) =>
  success(res, await positionService.livraisonPosition(req.user, req.validated.params.id))
);

const trajet = asyncHandler(async (req, res) =>
  success(res, await positionService.trajet(req.validated.params.id, req.validated.query.limit))
);

const itineraire = asyncHandler(async (req, res) =>
  success(res, await positionService.itineraire(req.user, req.validated.params.id))
);

module.exports = { share, list, livraisonPosition, trajet, itineraire };