const cron = require('node-cron');
const affectationService = require('../services/affectation.service');

// Exécute une tâche sans chevauchement : si l'exécution précédente n'est pas finie, on saute le tour
const guarded = (name, fn) => {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      console.error(`[tâche ${name}] erreur :`, err.message);
    } finally {
      running = false;
    }
  };
};

const startJobs = () => {
  // Chaque minute : expiration des propositions de mission restées sans réponse
  cron.schedule(
    '* * * * *',
    guarded('expiration-propositions', async () => {
      const expired = await affectationService.expireOverdue();
      if (expired > 0) console.log(`[tâche] ${expired} proposition(s) de mission expirée(s)`);
    })
  );
  console.log('Tâches planifiées démarrées');
};

module.exports = { startJobs };