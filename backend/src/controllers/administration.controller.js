const asyncHandler = require('../utils/asyncHandler');
const { paginated } = require('../utils/response');
const administrationService = require('../services/administration.service');

const listPaiements = asyncHandler(async (req, res) => {
  const { items, meta } = await administrationService.listPaiements(req.validated.query);
  return paginated(res, items, meta);
});

const listAudit = asyncHandler(async (req, res) => {
  const { items, meta } = await administrationService.listAudit(req.validated.query);
  return paginated(res, items, meta);
});

module.exports = { listPaiements, listAudit };