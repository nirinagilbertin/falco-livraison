const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/paiement.validator');
const controller = require('../controllers/paiement.controller');

const router = Router();

// Monté avant le routeur des demandes : l'authentification est déclarée route par route (voir execution.routes.js)
router.post('/:id/paiements', authenticate, authorize('expediteur'), validate({ params: idParam, body: schemas.pay }), controller.pay);
router.get('/:id/paiements', authenticate, authorize('expediteur', 'administrateur'), validate({ params: idParam }), controller.list);

module.exports = router;