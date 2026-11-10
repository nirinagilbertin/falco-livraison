const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/affectation.validator');
const controller = require('../controllers/affectation.controller');

const router = Router();

router.use(authenticate);

// Espace livreur : ses propositions et ses missions
router.get('/', authorize('livreur'), validate({ query: schemas.listQuery }), controller.listMine);
router.get('/:id', authorize('livreur', 'administrateur', 'gestionnaire', 'superviseur'), validate({ params: idParam }), controller.getById);
router.post('/:id/accepter', authorize('livreur'), validate({ params: idParam }), controller.accept);
router.post('/:id/refuser', authorize('livreur'), validate({ params: idParam, body: schemas.refuse }), controller.refuse);

// Annulation d'une proposition en attente : gestionnaire et administrateur
router.post('/:id/annuler', authorize('administrateur', 'gestionnaire'), validate({ params: idParam }), controller.cancel);

module.exports = router;