const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const profilRepository = require('../repositories/profil.repository');
const authService = require('./auth.service');
const auditService = require('./audit.service');

const fieldError = (field, message) =>
  new AppError('Données invalides', 400, 'VALIDATION_ERROR', [{ in: 'body', field, message }]);

// CU-04 : l'utilisateur modifie ses propres informations (champs limités selon son rôle)
const update = async (user, data) => {
  if (user.role === 'expediteur') {
    const profil = await profilRepository.findByCompte('expediteur', user.id_compte);
    if (data.secteur && profil.type_expediteur === 'client') {
      throw fieldError('secteur', "Le secteur d'activité est réservé aux partenaires commerciaux");
    }
    if (data.secteur === null && profil.type_expediteur !== 'client') {
      throw fieldError('secteur', "Le secteur d'activité est obligatoire pour un partenaire commercial");
    }
  }

  await withTransaction(async (conn) => {
    await profilRepository.updateByCompte(conn, user.role, user.id_compte, data);
    await auditService.log(
      { id_compte: user.id_compte, action: 'modification', type_objet: 'profil', id_objet: user.id_compte, details: `champs=${Object.keys(data).join(',')}` },
      conn
    );
  });
  return authService.getMe(user.id_compte);
};

module.exports = { update };