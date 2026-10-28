// Petits helpers pour construire des requêtes dynamiques sans concaténer de valeurs utilisateur.
// Les valeurs passent toujours par des paramètres nommés ; seuls des noms de colonnes
// issus de listes fixes (écrites dans le code) sont insérés dans le SQL.

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');
const likeParam = (q) => `%${escapeLike(q)}%`;

const buildWhere = (clauses) => (clauses.length ? `WHERE ${clauses.join(' AND ')}` : '');

// LIMIT / OFFSET insérés en entiers (déjà validés) : évite le piège des paramètres LIMIT
// avec les requêtes préparées de MySQL 8.0.22+.
const buildLimit = ({ limit, offset }) => `LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;

// Construit "col1 = :col1, col2 = :col2" pour les seules colonnes autorisées et présentes dans data
const buildSet = (data, allowedColumns) => {
  const columns = allowedColumns.filter((c) => data[c] !== undefined);
  return {
    sql: columns.map((c) => `${c} = :${c}`).join(', '),
    params: Object.fromEntries(columns.map((c) => [c, data[c]])),
    count: columns.length,
  };
};

module.exports = { likeParam, buildWhere, buildLimit, buildSet };