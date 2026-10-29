const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/livreur.validator');
const controller = require('../controllers/livreur.controller');

const router = Router();

router.use(authenticate, authorize('administrateur', 'gestionnaire'));

router.get('/', validate({ query: schemas.listQuery }), controller.list);
router.post('/', validate({ body: schemas.create }), controller.create);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.patch('/:id', validate({ params: idParam, body: schemas.update }), controller.update);
router.delete('/:id', validate({ params: idParam }), controller.remove);

module.exports = router;