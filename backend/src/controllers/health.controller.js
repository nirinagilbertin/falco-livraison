const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const healthService = require('../services/health.service');

const checkDatabase = asyncHandler(async (req, res) => {
  const data = await healthService.checkDatabase();
  return success(res, data);
});

module.exports = { checkDatabase };