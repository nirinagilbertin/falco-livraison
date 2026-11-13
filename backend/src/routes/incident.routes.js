const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/incident.validator');
const controller = require('../controllers/incident.controller');

const router = Router();

const managers = authorize('administrateur', 'gestionnaire');
const everyone = authorize('administrateur', 'gestionnaire', 'superviseur', 'livreur', 'expediteur');

router.use(authenticate);

// Déclaration par le livreur affecté ou l'expéditeur de la livraison (CU-18)
router.post('/', authorize('livreur', 'expediteur'), validate({ body: schemas.declare }), controller.declare);

// Consultation : le personnel voit tout, un livreur ou un expéditeur voit ses propres incidents
router.get('/', everyone, validate({ query: schemas.listQuery }), controller.list);
router.get('/:id', everyone, validate({ params: idParam }), controller.getById);

// Traitement par le gestionnaire (CU-19) ; le superviseur suit sans agir
router.post('/:id/prendre-en-charge', managers, validate({ params: idParam }), controller.takeOver);
router.post('/:id/resoudre', managers, validate({ params: idParam, body: schemas.resolve }), controller.resolve);

module.exports = router;