const asyncHandler = require('../utils/asyncHandler');
const { success, paginated } = require('../utils/response');
const affectationService = require('../services/affectation.service');

const listMine = asyncHandler(async (req, res) => {
  const { items, meta } = await affectationService.listMine(req.user, req.validated.query);
  return paginated(res, items, meta);
});

const getById = asyncHandler(async (req, res) => success(res, await affectationService.getDetail(req.user, req.validated.params.id)));

const accept = asyncHandler(async (req, res) =>
  success(res, await affectationService.accept(req.user, req.validated.params.id), { message: 'Mission acceptée' })
);

const refuse = asyncHandler(async (req, res) =>
  success(res, await affectationService.refuse(req.user, req.validated.params.id, req.body.motif), { message: 'Mission refusée' })
);

const cancel = asyncHandler(async (req, res) =>
  success(res, await affectationService.cancelProposal(req.user, req.validated.params.id), { message: 'Proposition annulée' })
);

module.exports = { listMine, getById, accept, refuse, cancel };