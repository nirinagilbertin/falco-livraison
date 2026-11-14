const { executor } = require('../config/db');

const BATCH = 5000;

const days = (value, fallback) => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Supprime par lots pour ne pas verrouiller la table longtemps ; renvoie le nombre total de lignes supprimées
const deleteInBatches = async (sql) => {
  let total = 0;
  for (;;) {
    const result = await executor()(`${sql} LIMIT ${BATCH}`);
    total += result.affectedRows;
    if (result.affectedRows < BATCH) return total;
  }
};

// R37 : l'historique des positions est conservé pour une durée limitée
const purgePositions = (retentionDays) =>
  deleteInBatches(`DELETE FROM position_gps WHERE date_enregistrement < DATE_SUB(NOW(), INTERVAL ${days(retentionDays, 30)} DAY)`);

// Les notifications déjà lues sont supprimées après un délai
const purgeReadNotifications = (retentionDays) =>
  deleteInBatches(
    `DELETE FROM notification WHERE statut = 'lue' AND date_lecture < DATE_SUB(NOW(), INTERVAL ${days(retentionDays, 90)} DAY)`
  );

module.exports = { purgePositions, purgeReadNotifications };