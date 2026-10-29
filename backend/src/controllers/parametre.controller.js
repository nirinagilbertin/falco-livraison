const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const parametreService = require('../services/parametre.service');

const list = asyncHandler(async (req, res) => success(res, await parametreService.list()));

const update = asyncHandler(async (req, res) =>
  success(res, await parametreService.update(req.user, req.params.cle, req.body.valeur), { message: 'Paramètre modifié' })
);

module.exports = { list, update };