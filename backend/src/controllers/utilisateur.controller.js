const asyncHandler = require('../utils/asyncHandler');
const { success, created, paginated } = require('../utils/response');
const utilisateurService = require('../services/utilisateur.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await utilisateurService.list(req.validated.query);
  return paginated(res, items, meta);
});

const getById = asyncHandler(async (req, res) => success(res, await utilisateurService.getById(req.validated.params.id)));

const create = asyncHandler(async (req, res) =>
  created(res, await utilisateurService.createInterne(req.user, req.body), 'Compte créé : transmettez le mot de passe temporaire à son titulaire')
);

const changeRole = asyncHandler(async (req, res) =>
  success(res, await utilisateurService.changeRole(req.user, req.validated.params.id, req.body.role), { message: 'Rôle modifié' })
);

const suspend = asyncHandler(async (req, res) =>
  success(res, await utilisateurService.suspend(req.user, req.validated.params.id), { message: 'Compte suspendu' })
);

const reactivate = asyncHandler(async (req, res) =>
  success(res, await utilisateurService.reactivate(req.user, req.validated.params.id), { message: 'Compte réactivé' })
);

const remove = asyncHandler(async (req, res) =>
  success(res, await utilisateurService.remove(req.user, req.validated.params.id), { message: 'Compte supprimé' })
);

module.exports = { list, getById, create, changeRole, suspend, reactivate, remove };