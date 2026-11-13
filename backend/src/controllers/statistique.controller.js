const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const statistiqueService = require('../services/statistique.service');

const dashboard = asyncHandler(async (req, res) => success(res, await statistiqueService.dashboard(req.validated.query)));
const evolution = asyncHandler(async (req, res) => success(res, await statistiqueService.evolution(req.validated.query)));
const livreurs = asyncHandler(async (req, res) => success(res, await statistiqueService.livreurs(req.validated.query)));
const me = asyncHandler(async (req, res) => success(res, await statistiqueService.me(req.user, req.validated.query)));

module.exports = { dashboard, evolution, livreurs, me };