const app = require('./app');
const env = require('./config/env');
const { testConnection, pool } = require('./config/db');

const start = async () => {
  try {
    await testConnection();
    console.log(`Base de données connectée (${env.db.name} sur ${env.db.host}:${env.db.port})`);
  } catch (err) {
    console.error(`Connexion à la base impossible : ${err.message}`);
    console.error('Vérifie que MySQL est démarré dans XAMPP et que le schéma est importé.');
    process.exit(1);
  }
  return app.listen(env.port, () => {
    console.log(`Falco Livraison API démarrée sur http://localhost:${env.port}/api (${env.nodeEnv})`);
  });
};

let server;
start().then((s) => { server = s; });

const shutdown = (signal) => {
  console.log(`${signal} reçu, arrêt du serveur...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));