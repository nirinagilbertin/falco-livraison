const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const schemas = require('../validators/profil.validator');
const controller = require('../controllers/profil.controller');

const router = Router();

// Les champs acceptés dépendent du rôle de l'utilisateur connecté
const validateByRole = (req, res, next) => validate({ body: schemas.byRole[req.user.role] })(req, res, next);

router.patch('/', authenticate, validateByRole, controller.update);

module.exports = router;