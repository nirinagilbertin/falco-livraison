const mysql = require('mysql2/promise');
const env = require('./env');

// Pool de connexions partagé par toute l'application
const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  decimalNumbers: true,    // DECIMAL renvoyés en nombres (frais, coordonnées GPS)
  namedPlaceholders: true, // requêtes avec :nom au lieu de ?
});

// Exécute une requête et renvoie les lignes (ou le résultat pour INSERT/UPDATE)
const query = async (sql, params = {}) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

// Renvoie une fonction (sql, params) qui s'exécute dans la transaction `conn` si elle est fournie,
// sinon via le pool. Permet à un repository de servir avec ou sans transaction.
const executor = (conn) =>
  conn ? async (sql, params = {}) => (await conn.execute(sql, params))[0] : query;

// Exécute plusieurs requêtes dans une transaction : commit si tout réussit, rollback sinon
// Usage : await withTransaction(async (conn) => { await conn.execute(...); });
const withTransaction = async (callback) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// Vérifie que la base répond (utilisé au démarrage et par /api/health/db)
const testConnection = async () => {
  await pool.query('SELECT 1');
};

module.exports = { pool, query, executor, withTransaction, testConnection };