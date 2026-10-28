const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../utils/jwt');
const compteRepository = require('../repositories/compte.repository');

// Vérifie le jeton Bearer, recharge le compte en base (un compte suspendu perd l'accès immédiatement)
// et place l'utilisateur dans req.user.
// Par défaut, un compte avec mot de passe temporaire est bloqué (PASSWORD_CHANGE_REQUIRED) ;
// authenticate.allowTemporaryPassword sert uniquement aux routes /me et /change-password.
const build = (allowTemporaryPassword) =>
  asyncHandler(async (req, res, next) => {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) throw AppError.unauthorized();

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw new AppError('Session expirée, reconnectez-vous', 401, 'TOKEN_EXPIRED');
      throw AppError.unauthorized('Jeton invalide');
    }

    const compte = await compteRepository.findById(Number(payload.sub));
    if (!compte) throw AppError.unauthorized('Jeton invalide');
    if (compte.statut !== 'actif') throw new AppError('Votre compte est suspendu', 403, 'ACCOUNT_SUSPENDED');
    if (compte.mot_de_passe_temporaire && !allowTemporaryPassword) {
      throw new AppError('Vous devez changer votre mot de passe temporaire', 403, 'PASSWORD_CHANGE_REQUIRED');
    }

    req.user = {
      id_compte: compte.id_compte,
      role: compte.role,
      email: compte.email,
      nom_utilisateur: compte.nom_utilisateur,
    };
    next();
  });

module.exports = build(false);
module.exports.allowTemporaryPassword = build(true);