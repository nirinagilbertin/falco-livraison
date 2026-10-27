// Erreur métier avec code HTTP, interceptée par le middleware d'erreurs
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) { return new AppError(message, 400, 'BAD_REQUEST', details); }
  static unauthorized(message = 'Authentification requise') { return new AppError(message, 401, 'UNAUTHORIZED'); }
  static forbidden(message = 'Accès refusé') { return new AppError(message, 403, 'FORBIDDEN'); }
  static notFound(message = 'Ressource introuvable') { return new AppError(message, 404, 'NOT_FOUND'); }
  static conflict(message) { return new AppError(message, 409, 'CONFLICT'); }
}

module.exports = AppError;
