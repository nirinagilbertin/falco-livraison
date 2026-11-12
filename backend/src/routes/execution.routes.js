const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/execution.validator');
const controller = require('../controllers/execution.controller');

const router = Router();

// L'authentification est déclarée route par route : ce routeur est monté avant celui des livraisons (suivi),
// et un router.use(authenticate) ici s'appliquerait deux fois aux routes de consultation.
const livreur = [authenticate, authorize('livreur')];
const managers = [authenticate, authorize('administrateur', 'gestionnaire')];

// Exécution d'une livraison par le livreur affecté (CU-14, CU-16)
router.post('/:id/verifier', ...livreur, validate({ params: idParam, body: schemas.verify }), controller.verify);
router.post('/:id/recuperer', ...livreur, validate({ params: idParam }), controller.pickup);
router.post('/:id/livrer', ...livreur, validate({ params: idParam, body: schemas.deliver }), controller.deliver);
router.post('/:id/echec', ...livreur, validate({ params: idParam, body: schemas.fail }), controller.fail);

// Confirmation du dépôt d'un colis rapporté après un échec (CU-13)
router.post('/:id/confirmer-depot', ...managers, validate({ params: idParam, body: schemas.deposit }), controller.confirmDeposit);

module.exports = router;