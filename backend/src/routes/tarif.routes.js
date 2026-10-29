const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/tarif.validator');
const controller = require('../controllers/tarif.controller');

const router = Router();
const adminOnly = authorize('administrateur');

router.use(authenticate);

// Consultation du tarif actif et estimation : tout utilisateur connecté (à déclarer avant /:id)
router.get('/actif', controller.getActive);
router.get('/simuler', validate({ query: schemas.simulationQuery }), controller.simulate);

// Gestion des tarifs : administrateur uniquement (CU-22)
router.get('/', adminOnly, validate({ query: schemas.listQuery }), controller.list);
router.post('/', adminOnly, validate({ body: schemas.create }), controller.create);
router.get('/:id', adminOnly, validate({ params: idParam }), controller.getById);
router.post('/:id/activer', adminOnly, validate({ params: idParam }), controller.activate);

module.exports = router;