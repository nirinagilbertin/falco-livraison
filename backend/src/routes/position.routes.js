const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const schemas = require('../validators/position.validator');
const controller = require('../controllers/position.controller');

const router = Router();

router.use(authenticate);

// Le livreur partage sa position (CU-17)
router.post('/', authorize('livreur'), validate({ body: schemas.share }), controller.share);

// Le personnel consulte les dernières positions des livreurs (supervision)
router.get('/', authorize('administrateur', 'gestionnaire', 'superviseur'), validate({ query: schemas.listQuery }), controller.list);

module.exports = router;