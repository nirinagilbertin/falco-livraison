const { query } = require('../config/db');
const { executor } = require('../config/db');
const { buildSet } = require('../utils/sql');

// Table de profil selon le rôle du compte (valeurs fixes, jamais issues de la requête)
const PROFIL_TABLES = {
  administrateur: 'utilisateur_interne',
  gestionnaire: 'utilisateur_interne',
  superviseur: 'utilisateur_interne',
  livreur: 'livreur',
  expediteur: 'expediteur',
};

const findByCompte = async (role, id_compte) => {
  const table = PROFIL_TABLES[role];
  if (!table) return null;
  const rows = await query(`SELECT * FROM ${table} WHERE id_compte = :id_compte`, { id_compte });
  return rows[0] || null;
};

// Colonnes modifiables par l'utilisateur lui-même, selon la table de profil
const UPDATABLE_COLUMNS = {
  utilisateur_interne: ['nom', 'prenom', 'telephone'],
  livreur: ['telephone'],
  expediteur: ['nom_complet', 'telephone', 'adresse', 'secteur'],
};

const updateByCompte = async (conn, role, id_compte, data) => {
  const table = PROFIL_TABLES[role];
  const set = buildSet(data, UPDATABLE_COLUMNS[table] || []);
  if (!set.count) return;
  await executor(conn)(`UPDATE ${table} SET ${set.sql} WHERE id_compte = :id_compte`, { ...set.params, id_compte });
};

module.exports = { findByCompte, updateByCompte };