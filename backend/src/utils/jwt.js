const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signToken = (compte) =>
  jwt.sign({ role: compte.role }, env.jwt.secret, {
    subject: String(compte.id_compte),
    expiresIn: env.jwt.expiresIn,
    algorithm: 'HS256',
  });

const verifyToken = (token) => jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] });

// Durée de validité restante en secondes (pour le front)
const getExpiresIn = (token) => {
  const { iat, exp } = jwt.decode(token);
  return exp - iat;
};

module.exports = { signToken, verifyToken, getExpiresIn };