const AppError = require('../utils/AppError');

// À placer après authenticate. Usage : authorize('administrateur', 'gestionnaire')
module.exports = (...roles) => (req, res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  if (!roles.includes(req.user.role)) return next(AppError.forbidden('Accès refusé pour votre rôle'));
  next();
};