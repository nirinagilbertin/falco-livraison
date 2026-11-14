// Usage : npm run purge
const { pool } = require('../src/config/db');
const maintenanceService = require('../src/services/maintenance.service');

(async () => {
  try {
    const result = await maintenanceService.purge();
    console.log(`Purge terminée : ${result.positions} position(s) GPS et ${result.notifications} notification(s) supprimée(s).`);
  } catch (err) {
    console.error('Échec de la purge :', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();