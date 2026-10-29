const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { success, created, paginated } = require('../utils/response');
const tarifService = require('../services/tarif.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await tarifService.list(req.validated.query);
  return paginated(res, items, meta);
});

const getById = asyncHandler(async (req, res) => success(res, await tarifService.getById(req.validated.params.id)));

const getActive = asyncHandler(async (req, res) => {
  const tarif = await tarifService.getActive();
  if (!tarif) throw new AppError('Aucun tarif actif', 404, 'NO_ACTIVE_TARIFF');
  return success(res, tarif);
});

const create = asyncHandler(async (req, res) =>
  created(res, await tarifService.create(req.user, req.body), req.body.activer ? 'Tarif créé et activé' : 'Tarif créé')
);

const activate = asyncHandler(async (req, res) =>
  success(res, await tarifService.activate(req.user, req.validated.params.id), { message: 'Tarif activé' })
);

const simulate = asyncHandler(async (req, res) => success(res, await tarifService.simulate(req.validated.query)));

module.exports = { list, getById, getActive, create, activate, simulate };