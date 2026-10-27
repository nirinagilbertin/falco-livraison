const app = require('./app');
const env = require('./config/env');

const server = app.listen(env.port, () => {
  console.log(`Falco Livraison API démarrée sur http://localhost:${env.port}/api (${env.nodeEnv})`);
});

const shutdown = (signal) => {
  console.log(`${signal} reçu, arrêt du serveur...`);
  server.close(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
