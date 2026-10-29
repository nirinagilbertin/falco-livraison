const asyncHandler = require('../utils/asyncHandler');
const { success, created, paginated } = require('../utils/response');
const demandeService = require('../services/demande.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await demandeService.list(req.user, req.validated.query);
  return paginated(res, items, meta);
});

const getById = asyncHandler(async (req, res) => success(res, await demandeService.getById(req.user, req.validated.params.id)));

const create = asyncHandler(async (req, res) => {
  const demande = await demandeService.create(req.user, req.body);
  return created(res, demande, `Demande créée : numéro de suivi ${demande.numero_suivi}`);
});

const cancel = asyncHandler(async (req, res) =>
  success(res, await demandeService.cancel(req.user, req.validated.params.id, req.body.motif), { message: 'Demande annulée' })
);

module.exports = { list, getById, create, cancel };