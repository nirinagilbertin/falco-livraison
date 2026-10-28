const bcrypt = require('bcryptjs');
const env = require('../config/env');

const hashPassword = (plain) => bcrypt.hash(plain, env.bcryptRounds);
const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);

// Hash factice : permet de comparer quand l'e-mail n'existe pas,
// pour que le temps de réponse ne révèle pas si un compte existe.
const DUMMY_HASH = bcrypt.hashSync('mot-de-passe-factice', env.bcryptRounds);

module.exports = { hashPassword, comparePassword, DUMMY_HASH };