const { Router } = require('express');
const { z } = require('zod');
const AppError = require('../utils/AppError');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { PARAMETRES } = require('../config/parametres');
const controller = require('../controllers/parametre.controller');

const router = Router();

// La règle de validation de la valeur dépend du paramètre visé (registre config/parametres.js)
const validateValue = (req, res, next) => {
  const def = PARAMETRES[req.params.cle];
  if (!def) return next(AppError.notFound('Paramètre inconnu'));
  return validate({ body: z.object({ valeur: def.schema }) })(req, res, next);
};

router.use(authenticate, authorize('administrateur', 'gestionnaire'));

router.get('/', controller.list);
router.patch('/:cle', validateValue, controller.update);

module.exports = router;