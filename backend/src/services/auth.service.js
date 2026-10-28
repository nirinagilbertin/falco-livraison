const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { hashPassword, comparePassword, DUMMY_HASH } = require('../utils/password');
const { signToken, getExpiresIn } = require('../utils/jwt');
const compteRepository = require('../repositories/compte.repository');
const expediteurRepository = require('../repositories/expediteur.repository');
const profilRepository = require('../repositories/profil.repository');
const auditService = require('./audit.service');

// Compte sans données sensibles
const toPublic = (compte) => {
  const { mot_de_passe_hash, ...rest } = compte;
  return { ...rest, mot_de_passe_temporaire: Boolean(compte.mot_de_passe_temporaire) };
};

const buildSession = (compte) => {
  const token = signToken(compte);
  return { token, expires_in: getExpiresIn(token), compte: toPublic(compte) };
};

// CU-02 : inscription d'un expéditeur (client ou partenaire commercial)
const register = async (data) => {
  if (await compteRepository.existsByEmail(data.email)) {
    throw AppError.conflict('Cette adresse e-mail est déjà utilisée');
  }
  if (await compteRepository.existsByUsername(data.nom_utilisateur)) {
    throw AppError.conflict("Ce nom d'utilisateur est déjà utilisé");
  }

  const mot_de_passe_hash = await hashPassword(data.mot_de_passe);

  const id_compte = await withTransaction(async (conn) => {
    const id = await compteRepository.create(conn, {
      email: data.email,
      nom_utilisateur: data.nom_utilisateur,
      mot_de_passe_hash,
      role: 'expediteur',
    });
    await expediteurRepository.create(conn, {
      id_compte: id,
      type_expediteur: data.type_expediteur,
      nom_complet: data.nom_complet,
      telephone: data.telephone,
      adresse: data.adresse,
      secteur: data.secteur,
    });
    await auditService.log(
      { id_compte: id, action: 'inscription', type_objet: 'compte', id_objet: id, details: `type_expediteur=${data.type_expediteur}` },
      conn
    );
    return id;
  });

  return getMe(id_compte);
};

// CU-01 : connexion par e-mail et mot de passe
const login = async ({ email, mot_de_passe }) => {
  const compte = await compteRepository.findByEmail(email);
  // La comparaison a toujours lieu, même si le compte n'existe pas (voir DUMMY_HASH)
  const valid = await comparePassword(mot_de_passe, compte ? compte.mot_de_passe_hash : DUMMY_HASH);
  if (!compte || !valid) {
    throw new AppError('E-mail ou mot de passe incorrect', 401, 'INVALID_CREDENTIALS');
  }
  if (compte.statut !== 'actif') {
    throw new AppError('Votre compte est suspendu', 403, 'ACCOUNT_SUSPENDED');
  }
  await compteRepository.touchLastLogin(compte.id_compte);
  return buildSession(compte);
};

// Renouvelle le jeton d'un utilisateur actif (session glissante : expire après inactivité)
const refresh = async (user) => {
  const compte = await compteRepository.findById(user.id_compte);
  return buildSession(compte);
};

// Compte et profil lié à son rôle
const getMe = async (id_compte) => {
  const compte = await compteRepository.findById(id_compte);
  if (!compte) throw AppError.notFound('Compte introuvable');
  const profil = await profilRepository.findByCompte(compte.role, id_compte);
  return { compte: toPublic(compte), profil };
};

// CU-04 (partie mot de passe) : changement volontaire ou obligatoire (mot de passe temporaire)
const changePassword = async (user, { ancien_mot_de_passe, nouveau_mot_de_passe }) => {
  const compte = await compteRepository.findById(user.id_compte);
  if (!(await comparePassword(ancien_mot_de_passe, compte.mot_de_passe_hash))) {
    throw new AppError('Ancien mot de passe incorrect', 400, 'INVALID_PASSWORD');
  }
  const mot_de_passe_hash = await hashPassword(nouveau_mot_de_passe);

  await withTransaction(async (conn) => {
    await compteRepository.updatePassword(conn, compte.id_compte, mot_de_passe_hash);
    await auditService.log(
      { id_compte: compte.id_compte, action: 'changement_mot_de_passe', type_objet: 'compte', id_objet: compte.id_compte },
      conn
    );
  });

  // Nouveau jeton, sans l'obligation de changement
  return buildSession(await compteRepository.findById(compte.id_compte));
};

module.exports = { register, login, refresh, getMe, changePassword };