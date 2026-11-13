const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const schemas = require('../validators/statistique.validator');
const controller = require('../controllers/statistique.controller');

const router = Router();

const global = authorize('administrateur', 'superviseur');

router.use(authenticate);

// Vue globale et supervision
router.get('/tableau-de-bord', global, validate({ query: schemas.periodQuery }), controller.dashboard);
router.get('/evolution', global, validate({ query: schemas.evolutionQuery }), controller.evolution);
router.get('/livreurs', global, validate({ query: schemas.periodQuery }), controller.livreurs);

// Statistiques personnelles : expéditeur (client, partenaire) et livreur
router.get('/moi', authorize('expediteur', 'livreur'), validate({ query: schemas.periodQuery }), controller.me);

module.exports = router;