const asyncHandler = require('../utils/asyncHandler');
const { success, created, paginated } = require('../utils/response');
const livraisonService = require('../services/livraison.service');
const affectationService = require('../services/affectation.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await livraisonService.list(req.validated.query);
  return paginated(res, items, meta);
});

const getById = asyncHandler(async (req, res) => success(res, await livraisonService.getById(req.validated.params.id)));

const eligibles = asyncHandler(async (req, res) => success(res, await affectationService.listEligible(req.validated.params.id)));

const assign = asyncHandler(async (req, res) =>
  created(res, await affectationService.assignManually(req.user, req.validated.params.id, req.body.id_livreur), 'Mission proposée au livreur')
);

const retrySearch = asyncHandler(async (req, res) => {
  const result = await affectationService.retrySearch(req.user, req.validated.params.id);
  return success(res, result, {
    message: result.proposed ? 'Mission proposée au livreur le plus proche' : 'Aucun livreur éligible pour le moment',
  });
});

module.exports = { list, getById, eligibles, assign, retrySearch };