const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { idParam } = require('../validators/common.validator');
const controller = require('../controllers/redistribution.controller');

const router = Router();

// Authentification route par route : ce routeur est monté avant les autres routeurs de /livraisons
const managers = [authenticate, authorize('administrateur', 'gestionnaire')];
const assign = z.object({ id_livreur: z.coerce.number().int().positive() });

// Lancement manuel de la redistribution (dédéclarer avant /:id/...)
router.post('/redistribution/lancer', ...managers, controller.run);

// Réaffectation d'une livraison reprise au dépôt
router.post('/:id/affecter-depot', ...managers, validate({ params: idParam, body: assign }), controller.assignDepot);

module.exports = router;