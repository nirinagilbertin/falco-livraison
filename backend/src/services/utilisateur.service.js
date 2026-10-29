const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { getPagination, buildMeta } = require('../utils/pagination');
const { hashPassword } = require('../utils/password');
const { generateTemporaryPassword } = require('../utils/tempPassword');
const compteRepository = require('../repositories/compte.repository');
const utilisateurInterneRepository = require('../repositories/utilisateurInterne.repository');
const utilisateurRepository = require('../repositories/utilisateur.repository');
const authService = require('./auth.service');
const auditService = require('./audit.service');

// Les comptes administrateur ne se modifient pas, ne se suspendent pas et ne se suppriment pas par l'API
// (cela protège aussi contre la suspension de son propre compte ou du dernier administrateur).
const getManageable = async (id) => {
  const compte = await compteRepository.findById(id);
  if (!compte) throw AppError.notFound('Compte introuvable');
  if (compte.role === 'administrateur') {
    throw AppError.forbidden('Les comptes administrateur ne peuvent pas être modifiés, suspendus ou supprimés ici');
  }
  return compte;
};

const list = async (query) => {
  const pagination = getPagination(query);
  const { items, total } = await utilisateurRepository.list(query, pagination);
  return { items, meta: buildMeta(pagination, total) };
};

const getById = async (id) => authService.getMe(id);

// CU-03 : création d'un compte interne (gestionnaire ou superviseur) avec mot de passe temporaire
const createInterne = async (user, data) => {
  if (await compteRepository.existsByEmail(data.email)) throw AppError.conflict('Cette adresse e-mail est déjà utilisée');
  if (await compteRepository.existsByUsername(data.nom_utilisateur)) throw AppError.conflict("Ce nom d'utilisateur est déjà utilisé");

  const mot_de_passe_initial = generateTemporaryPassword();
  const mot_de_passe_hash = await hashPassword(mot_de_passe_initial);

  const id_compte = await withTransaction(async (conn) => {
    const id = await compteRepository.create(conn, {
      email: data.email,
      nom_utilisateur: data.nom_utilisateur,
      mot_de_passe_hash,
      role: data.role,
      mot_de_passe_temporaire: 1,
    });
    await utilisateurInterneRepository.create(conn, { id_compte: id, nom: data.nom, prenom: data.prenom, telephone: data.telephone });
    await auditService.log(
      { id_compte: user.id_compte, action: 'creation', type_objet: 'compte', id_objet: id, details: `role=${data.role}` },
      conn
    );
    return id;
  });

  // Le mot de passe temporaire n'est affiché qu'une seule fois, à la création
  return { ...(await authService.getMe(id_compte)), mot_de_passe_initial };
};

const changeRole = async (user, id, role) => {
  const compte = await getManageable(id);
  if (!['gestionnaire', 'superviseur'].includes(compte.role)) {
    throw AppError.badRequest('Seul le rôle d\'un compte interne (gestionnaire ou superviseur) peut être modifié');
  }
  if (compte.role === role) throw AppError.conflict('Ce compte a déjà ce rôle');

  await withTransaction(async (conn) => {
    await utilisateurRepository.updateRole(conn, id, role);
    await auditService.log(
      { id_compte: user.id_compte, action: 'changement_role', type_objet: 'compte', id_objet: id, details: `${compte.role} -> ${role}` },
      conn
    );
  });
  return authService.getMe(id);
};

const setStatut = (statut, action, errorMessage) => async (user, id) => {
  const compte = await getManageable(id);
  if (compte.statut === statut) throw AppError.conflict(errorMessage);

  await withTransaction(async (conn) => {
    await utilisateurRepository.updateStatut(conn, id, statut);
    await auditService.log({ id_compte: user.id_compte, action, type_objet: 'compte', id_objet: id, details: `role=${compte.role}` }, conn);
  });
  return authService.getMe(id);
};

const suspend = setStatut('suspendu', 'suspension', 'Ce compte est déjà suspendu');
const reactivate = setStatut('actif', 'reactivation', 'Ce compte est déjà actif');

// Suppression définitive : seulement sans historique (CU-03, A3), sinon la suspension est proposée
const remove = async (user, id) => {
  const compte = await getManageable(id);
  try {
    await withTransaction(async (conn) => {
      await auditService.log(
        { id_compte: user.id_compte, action: 'suppression', type_objet: 'compte', id_objet: id, details: `role=${compte.role}` },
        conn
      );
      await utilisateurRepository.deleteAccount(conn, { id_compte: id, role: compte.role });
    });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw AppError.conflict('Ce compte a un historique et ne peut pas être supprimé : suspendez-le plutôt');
    }
    throw err;
  }
  return { supprime: true };
};

module.exports = { list, getById, createInterne, changeRole, suspend, reactivate, remove };