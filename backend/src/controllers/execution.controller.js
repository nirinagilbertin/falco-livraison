const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const executionService = require('../services/execution.service');

const verify = asyncHandler(async (req, res) =>
  success(res, await executionService.verify(req.user, req.validated.params.id, req.body), { message: 'Colis vérifié : en attente du paiement de l\'expéditeur' })
);

const pickup = asyncHandler(async (req, res) =>
  success(res, await executionService.pickup(req.user, req.validated.params.id), { message: 'Colis récupéré : livraison en cours' })
);

const deliver = asyncHandler(async (req, res) =>
  success(res, await executionService.deliver(req.user, req.validated.params.id, req.body), { message: 'Livraison terminée' })
);

const fail = asyncHandler(async (req, res) =>
  success(res, await executionService.fail(req.user, req.validated.params.id, req.body), { message: 'Livraison signalée comme inachevée' })
);

const confirmDeposit = asyncHandler(async (req, res) =>
  success(res, await executionService.confirmDeposit(req.user, req.validated.params.id, req.body.id_depot), { message: 'Dépôt du colis confirmé' })
);

module.exports = { verify, pickup, deliver, fail, confirmDeposit };