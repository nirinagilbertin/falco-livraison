const asyncHandler = require('../utils/asyncHandler');
const { success, created, paginated } = require('../utils/response');
const depotService = require('../services/depot.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await depotService.list(req.validated.query);
  return paginated(res, items, meta);
});

const getById = asyncHandler(async (req, res) =>
  success(res, await depotService.getById(req.validated.params.id))
);

const create = asyncHandler(async (req, res) =>
  created(res, await depotService.create(req.user, req.body), 'Dépôt créé')
);

const update = asyncHandler(async (req, res) =>
  success(res, await depotService.update(req.user, req.validated.params.id, req.body), { message: 'Dépôt modifié' })
);

const remove = asyncHandler(async (req, res) => {
  const result = await depotService.remove(req.user, req.validated.params.id);
  return success(res, result, {
    message: result.supprime ? 'Dépôt supprimé' : 'Dépôt désactivé (lié à un historique)',
  });
});

module.exports = { list, getById, create, update, remove };