const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/demande.validator');
const controller = require('../controllers/demande.controller');

const router = Router();

// Consultation : l'expéditeur voit ses demandes, les rôles internes voient toutes les demandes (CU-06, CU-09)
const readers = authorize('administrateur', 'gestionnaire', 'superviseur', 'expediteur');
// Création et annulation : uniquement l'expéditeur. Le gestionnaire ne crée jamais de demande (R06).
const senders = authorize('expediteur');

router.use(authenticate);

router.get('/', readers, validate({ query: schemas.listQuery }), controller.list);
router.post('/', senders, validate({ body: schemas.create }), controller.create);
router.get('/:id', readers, validate({ params: idParam }), controller.getById);
router.post('/:id/annuler', senders, validate({ params: idParam, body: schemas.cancel }), controller.cancel);

module.exports = router;