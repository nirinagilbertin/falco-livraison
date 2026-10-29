const asyncHandler = require('../utils/asyncHandler');
const { success, created, paginated } = require('../utils/response');
const livreurService = require('../services/livreur.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await livreurService.list(req.validated.query);
  return paginated(res, items, meta);
});

const getById = asyncHandler(async (req, res) => success(res, await livreurService.getById(req.validated.params.id)));

const create = asyncHandler(async (req, res) =>
  created(res, await livreurService.create(req.user, req.body), 'Livreur créé : transmettez-lui le mot de passe temporaire')
);

const update = asyncHandler(async (req, res) =>
  success(res, await livreurService.update(req.user, req.validated.params.id, req.body), { message: 'Livreur modifié' })
);

const remove = asyncHandler(async (req, res) => {
  const result = await livreurService.remove(req.user, req.validated.params.id);
  return success(res, result, {
    message: result.supprime ? 'Livreur supprimé' : 'Livreur désactivé (lié à un historique)',
  });
});

module.exports = { list, getById, create, update, remove };