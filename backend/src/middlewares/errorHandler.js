const AppError = require('../utils/AppError');
const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  // JSON invalide envoyé par le client
  if (err.type === 'entity.parse.failed') {
    err = AppError.badRequest('Corps de requête JSON invalide');
  }

  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;

  if (!isAppError) console.error(err);

  res.status(statusCode).json({
    success: false,
    error: {
      code: isAppError ? err.code : 'INTERNAL_ERROR',
      message: isAppError || !env.isProduction ? err.message : 'Erreur interne du serveur',
      ...(isAppError && err.details ? { details: err.details } : {}),
      ...(!env.isProduction && !isAppError ? { stack: err.stack } : {}),
    },
  });
};
