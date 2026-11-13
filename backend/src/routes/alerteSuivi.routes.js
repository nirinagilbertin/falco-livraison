const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/alerte.validator');
const controller = require('../controllers/alerteSuivi.controller');

const router = Router();

const staff = authorize('administrateur', 'gestionnaire', 'superviseur');
const managers = authorize('administrateur', 'gestionnaire');

router.use(authenticate);

router.get('/', staff, validate({ query: schemas.alertListQuery }), controller.list);
router.get('/:id', staff, validate({ params: idParam }), controller.getById);

// Le superviseur suit les alertes sans action corrective (CU-20)
router.post('/:id/prendre-en-charge', managers, validate({ params: idParam }), controller.takeOver);
router.post('/:id/resoudre', managers, validate({ params: idParam }), controller.resolve);

module.exports = router;