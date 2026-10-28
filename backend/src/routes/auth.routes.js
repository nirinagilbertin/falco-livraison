const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const env = require('../config/env');
const AppError = require('../utils/AppError');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const controller = require('../controllers/auth.controller');
const schemas = require('../validators/auth.validator');

const router = Router();

// Limite les tentatives de connexion / inscription par adresse IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skip: () => env.nodeEnv === 'test',
  handler: (req, res, next) => next(new AppError('Trop de tentatives, réessayez dans quelques minutes', 429, 'TOO_MANY_REQUESTS')),
});

router.post('/register', authLimiter, validate({ body: schemas.register }), controller.register);
router.post('/login', authLimiter, validate({ body: schemas.login }), controller.login);
router.post('/refresh', authenticate, controller.refresh);
router.get('/me', authenticate.allowTemporaryPassword, controller.me);
router.post(
  '/change-password',
  authenticate.allowTemporaryPassword,
  validate({ body: schemas.changePassword }),
  controller.changePassword
);

module.exports = router;