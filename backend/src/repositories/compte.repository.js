const { executor } = require('../config/db');

const COLUMNS = `id_compte, email, nom_utilisateur, mot_de_passe_hash, role, statut,
  mot_de_passe_temporaire, photo_profil, date_creation, derniere_connexion`;

const findByEmail = async (email, conn) => {
  const rows = await executor(conn)(`SELECT ${COLUMNS} FROM compte WHERE email = :email`, { email });
  return rows[0] || null;
};

const findById = async (id_compte, conn) => {
  const rows = await executor(conn)(`SELECT ${COLUMNS} FROM compte WHERE id_compte = :id_compte`, { id_compte });
  return rows[0] || null;
};

const existsByEmail = async (email, conn) =>
  (await executor(conn)('SELECT 1 FROM compte WHERE email = :email LIMIT 1', { email })).length > 0;

const existsByUsername = async (nom_utilisateur, conn) =>
  (await executor(conn)('SELECT 1 FROM compte WHERE nom_utilisateur = :nom_utilisateur LIMIT 1', { nom_utilisateur })).length > 0;

// Crée un compte et renvoie son identifiant
const create = async (conn, { email, nom_utilisateur, mot_de_passe_hash, role, mot_de_passe_temporaire = 0 }) => {
  const result = await executor(conn)(
    `INSERT INTO compte (email, nom_utilisateur, mot_de_passe_hash, role, mot_de_passe_temporaire)
     VALUES (:email, :nom_utilisateur, :mot_de_passe_hash, :role, :mot_de_passe_temporaire)`,
    { email, nom_utilisateur, mot_de_passe_hash, role, mot_de_passe_temporaire }
  );
  return result.insertId;
};

// Change le mot de passe et lève l'obligation de changement
const updatePassword = (conn, id_compte, mot_de_passe_hash) =>
  executor(conn)(
    'UPDATE compte SET mot_de_passe_hash = :mot_de_passe_hash, mot_de_passe_temporaire = 0 WHERE id_compte = :id_compte',
    { id_compte, mot_de_passe_hash }
  );

const touchLastLogin = (id_compte) =>
  executor()('UPDATE compte SET derniere_connexion = NOW() WHERE id_compte = :id_compte', { id_compte });

module.exports = { findByEmail, findById, existsByEmail, existsByUsername, create, updatePassword, touchLastLogin };