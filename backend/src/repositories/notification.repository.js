const { executor } = require('../config/db');

const create = (conn, { id_compte, type, libelle, id_livraison = null }) =>
  executor(conn)(
    'INSERT INTO notification (id_compte, type, libelle, id_livraison) VALUES (:id_compte, :type, :libelle, :id_livraison)',
    { id_compte, type, libelle: String(libelle).slice(0, 255), id_livraison }
  );

// Comptes actifs ayant l'un des rôles donnés
const findAccountIdsByRoles = async (conn, roles) => {
  const params = Object.fromEntries(roles.map((r, i) => [`r${i}`, r]));
  const placeholders = roles.map((_, i) => `:r${i}`).join(', ');
  const rows = await executor(conn)(`SELECT id_compte FROM compte WHERE statut = 'actif' AND role IN (${placeholders})`, params);
  return rows.map((r) => r.id_compte);
};

module.exports = { create, findAccountIdsByRoles };