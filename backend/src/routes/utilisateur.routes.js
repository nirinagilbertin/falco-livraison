const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/utilisateur.validator');
const controller = require('../controllers/utilisateur.controller');

const router = Router();

// Gestion des comptes : réservée à l'administrateur (CU-03)
router.use(authenticate, authorize('administrateur'));

router.get('/', validate({ query: schemas.listQuery }), controller.list);
router.post('/', validate({ body: schemas.create }), controller.create);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.patch('/:id/role', validate({ params: idParam, body: schemas.changeRole }), controller.changeRole);
router.post('/:id/suspendre', validate({ params: idParam }), controller.suspend);
router.post('/:id/reactiver', validate({ params: idParam }), controller.reactivate);
router.delete('/:id', validate({ params: idParam }), controller.remove);

module.exports = router;