const asyncHandler = require('../utils/asyncHandler');
const { success, created, paginated } = require('../utils/response');
const incidentService = require('../services/incident.service');

const declare = asyncHandler(async (req, res) => created(res, await incidentService.declare(req.user, req.body), 'Incident déclaré'));

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await incidentService.list(req.user, req.validated.query);
  return paginated(res, items, meta);
});

const getById = asyncHandler(async (req, res) => success(res, await incidentService.getById(req.user, req.validated.params.id)));

const takeOver = asyncHandler(async (req, res) =>
  success(res, await incidentService.takeOver(req.user, req.validated.params.id), { message: 'Incident pris en charge' })
);

const resolve = asyncHandler(async (req, res) =>
  success(res, await incidentService.resolve(req.user, req.validated.params.id, req.body.commentaire), { message: 'Incident résolu' })
);

module.exports = { declare, list, getById, takeOver, resolve };