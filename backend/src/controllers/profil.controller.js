const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const profilService = require('../services/profil.service');

const update = asyncHandler(async (req, res) =>
  success(res, await profilService.update(req.user, req.body), { message: 'Profil mis à jour' })
);

module.exports = { update };