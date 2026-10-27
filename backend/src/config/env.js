require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'falco_livraison',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

env.isProduction = env.nodeEnv === 'production';

// En production, le secret JWT est obligatoire
if (env.isProduction && !env.jwt.secret) {
  throw new Error('JWT_SECRET est obligatoire en production');
}

module.exports = env;
