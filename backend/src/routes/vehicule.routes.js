const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/vehicule.validator');
const controller = require('../controllers/vehicule.controller');

const router = Router();

const readers = authorize('administrateur', 'gestionnaire');
const writers = authorize('administrateur', 'gestionnaire');

router.use(authenticate);

router.get('/', readers, validate({ query: schemas.listQuery }), controller.list);
router.get('/:id', readers, validate({ params: idParam }), controller.getById);
router.post('/', writers, validate({ body: schemas.create }), controller.create);
router.patch('/:id', writers, validate({ params: idParam, body: schemas.update }), controller.update);
router.delete('/:id', writers, validate({ params: idParam }), controller.remove);

module.exports = router;