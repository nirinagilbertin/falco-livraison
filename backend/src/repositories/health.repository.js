const { query } = require('../config/db');

const getDatabaseInfo = async () => {
  const [row] = await query('SELECT VERSION() AS version, DATABASE() AS name, NOW() AS server_time');
  const tables = await query(
    'SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()'
  );
  return { ...row, tables: tables[0].total };
};

module.exports = { getDatabaseInfo };