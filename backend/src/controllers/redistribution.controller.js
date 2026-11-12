const asyncHandler = require('../utils/asyncHandler');
const { success, created } = require('../utils/response');
const redistributionService = require('../services/redistribution.service');

const run = asyncHandler(async (req, res) =>
  success(res, await redistributionService.run({ ignoreHour: true }), { message: 'Redistribution exécutée' })
);

const assignDepot = asyncHandler(async (req, res) =>
  created(
    res,
    await redistributionService.assignToLivreur(req.user, req.validated.params.id, req.body.id_livreur),
    'Proposition de reprise au dépôt envoyée'
  )
);

module.exports = { run, assignDepot };