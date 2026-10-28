const asyncHandler = require('../utils/asyncHandler');
const { success, created, paginated } = require('../utils/response');
const zoneService = require('../services/zone.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await zoneService.list(req.validated.query);
  return paginated(res, items, meta);
});

const getById = asyncHandler(async (req, res) =>
  success(res, await zoneService.getById(req.validated.params.id))
);

const create = asyncHandler(async (req, res) =>
  created(res, await zoneService.create(req.user, req.body), 'Zone créée')
);

const update = asyncHandler(async (req, res) =>
  success(res, await zoneService.update(req.user, req.validated.params.id, req.body), { message: 'Zone modifiée' })
);

const remove = asyncHandler(async (req, res) => {
  const result = await zoneService.remove(req.user, req.validated.params.id);
  return success(res, result, {
    message: result.supprime ? 'Zone supprimée' : 'Zone désactivée (liée à un historique)',
  });
});

module.exports = { list, getById, create, update, remove };