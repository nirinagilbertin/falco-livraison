const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/livraison.validator');
const controller = require('../controllers/livraison.controller');

const router = Router();

const viewers = authorize('administrateur', 'gestionnaire', 'superviseur');
const managers = authorize('administrateur', 'gestionnaire');

router.use(authenticate);

router.get('/', viewers, validate({ query: schemas.listQuery }), controller.list);
router.get('/:id', viewers, validate({ params: idParam }), controller.getById);

// Affectation et réaffectation (CU-11)
router.get('/:id/livreurs-eligibles', managers, validate({ params: idParam }), controller.eligibles);
router.post('/:id/affecter', managers, validate({ params: idParam, body: schemas.assign }), controller.assign);
router.post('/:id/relancer-recherche', managers, validate({ params: idParam }), controller.retrySearch);

module.exports = router;