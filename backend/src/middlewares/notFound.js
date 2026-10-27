const AppError = require('../utils/AppError');

module.exports = (req, res, next) => {
  next(AppError.notFound(`Route introuvable : ${req.method} ${req.originalUrl}`));
};
