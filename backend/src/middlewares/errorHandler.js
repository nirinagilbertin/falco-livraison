const AppError = require('../utils/AppError');
const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  // JSON invalide envoyé par le client
  if (err.type === 'entity.parse.failed') {
    err = AppError.badRequest('Corps de requête JSON invalide');
  }

    // Erreurs MySQL courantes traduites en erreurs HTTP lisibles
  if (err.code === 'ER_DUP_ENTRY') {
    err = AppError.conflict('Une valeur unique existe déjà (doublon)');
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    err = AppError.badRequest('Référence invalide : élément lié introuvable');
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    err = AppError.conflict('Suppression impossible : élément lié à un historique');
  } else if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    err = AppError.badRequest('Valeur refusée par une contrainte de la base');
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
