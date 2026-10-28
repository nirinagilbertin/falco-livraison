const asyncHandler = require('../utils/asyncHandler');
const { success, created, paginated } = require('../utils/response');
const vehiculeService = require('../services/vehicule.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await vehiculeService.list(req.validated.query);
  return paginated(res, items, meta);
});

const getById = asyncHandler(async (req, res) =>
  success(res, await vehiculeService.getById(req.validated.params.id))
);

const create = asyncHandler(async (req, res) =>
  created(res, await vehiculeService.create(req.user, req.body), 'Véhicule créé')
);

const update = asyncHandler(async (req, res) =>
  success(res, await vehiculeService.update(req.user, req.validated.params.id, req.body), { message: 'Véhicule modifié' })
);

const remove = asyncHandler(async (req, res) => {
  const result = await vehiculeService.remove(req.user, req.validated.params.id);
  return success(res, result, {
    message: result.supprime ? 'Véhicule supprimé' : 'Véhicule désactivé (lié à un historique)',
  });
});

module.exports = { list, getById, create, update, remove };