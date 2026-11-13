const asyncHandler = require('../utils/asyncHandler');
const { success, paginated } = require('../utils/response');
const notificationService = require('../services/notificationBox.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await notificationService.list(req.user, req.validated.query);
  return paginated(res, items, meta);
});

const markRead = asyncHandler(async (req, res) => success(res, await notificationService.markRead(req.user, req.validated.params.id)));

const markAllRead = asyncHandler(async (req, res) => success(res, await notificationService.markAllRead(req.user)));

module.exports = { list, markRead, markAllRead };