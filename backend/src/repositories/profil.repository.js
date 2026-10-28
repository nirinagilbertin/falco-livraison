const { query } = require('../config/db');

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

module.exports = { findByCompte };