const maintenanceRepository = require('../repositories/maintenance.repository');

// Durées de conservation en jours, modifiables dans le .env (30 et 90 par défaut)
const purge = async () => ({
  positions: await maintenanceRepository.purgePositions(process.env.GPS_RETENTION_DAYS),
  notifications: await maintenanceRepository.purgeReadNotifications(process.env.NOTIFICATION_RETENTION_DAYS),
});

module.exports = { purge };