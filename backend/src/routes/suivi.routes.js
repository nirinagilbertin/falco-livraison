const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/position.validator');
const controller = require('../controllers/position.controller');

const router = Router();

// Authentification route par route : ce routeur est monté avant les autres routeurs de /livraisons
const staff = ['administrateur', 'gestionnaire', 'superviseur'];

// Position du livreur : l'expéditeur la voit pendant la livraison (CU-15), le personnel à tout moment
router.get('/:id/position', authenticate, authorize(...staff, 'expediteur'), validate({ params: idParam }), controller.livraisonPosition);

// Trajet enregistré (suivi géographique)
router.get('/:id/trajet', authenticate, authorize(...staff), validate({ params: idParam, query: schemas.trackQuery }), controller.trajet);

// Itinéraire à suivre
router.get('/:id/itineraire', authenticate, authorize('livreur', ...staff), validate({ params: idParam }), controller.itineraire);

module.exports = router;