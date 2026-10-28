const healthRepository = require('../repositories/health.repository');

const checkDatabase = async () => {
  const info = await healthRepository.getDatabaseInfo();
  return { status: 'ok', database: info.name, version: info.version, tables: info.tables };
};

module.exports = { checkDatabase };