const asyncHandler = require('../utils/asyncHandler');
const { success, created } = require('../utils/response');
const authService = require('../services/auth.service');

const register = asyncHandler(async (req, res) =>
  created(res, await authService.register(req.body), 'Inscription réussie')
);

const login = asyncHandler(async (req, res) => success(res, await authService.login(req.body)));

const refresh = asyncHandler(async (req, res) => success(res, await authService.refresh(req.user)));

const me = asyncHandler(async (req, res) => success(res, await authService.getMe(req.user.id_compte)));

const changePassword = asyncHandler(async (req, res) =>
  success(res, await authService.changePassword(req.user, req.body), { message: 'Mot de passe modifié' })
);

module.exports = { register, login, refresh, me, changePassword };