const cron = require('node-cron');
const affectationService = require('../services/affectation.service');
const paiementService = require('../services/paiement.service');
const redistributionService = require('../services/redistribution.service');

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

  // Chaque minute : annulation des demandes vérifiées mais non payées dans le délai
  cron.schedule(
    '* * * * *',
    guarded('annulation-non-paiement', async () => {
      const cancelled = await paiementService.expireUnpaidOverdue();
      if (cancelled > 0) console.log(`[tâche] ${cancelled} demande(s) annulée(s) pour non-paiement`);
    })
  );

    // Toutes les 5 minutes : remise en attente des livraisons inachevées (jour commun) et propositions par vagues
  cron.schedule(
    '*/5 * * * *',
    guarded('redistribution', async () => {
      const { reactivated, proposed } = await redistributionService.run();
      if (reactivated > 0 || proposed > 0) {
        console.log(`[tâche] redistribution : ${reactivated} livraison(s) remise(s) en attente, ${proposed} proposition(s) envoyée(s)`);
      }
    })
  );
  
  console.log('Tâches planifiées démarrées');
};

module.exports = { startJobs };