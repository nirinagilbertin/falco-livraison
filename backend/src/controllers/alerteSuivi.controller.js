const asyncHandler = require('../utils/asyncHandler');
const { success, paginated } = require('../utils/response');
const alerteService = require('../services/alerteSuivi.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await alerteService.list(req.validated.query);
  return paginated(res, items, meta);
});

const getById = asyncHandler(async (req, res) => success(res, await alerteService.getById(req.validated.params.id)));

const takeOver = asyncHandler(async (req, res) =>
  success(res, await alerteService.takeOver(req.user, req.validated.params.id), { message: 'Alerte prise en charge' })
);

const resolve = asyncHandler(async (req, res) =>
  success(res, await alerteService.resolve(req.user, req.validated.params.id), { message: 'Alerte résolue' })
);

module.exports = { list, getById, takeOver, resolve };