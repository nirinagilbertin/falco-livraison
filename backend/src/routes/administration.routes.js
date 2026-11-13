const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const schemas = require('../validators/statistique.validator');
const controller = require('../controllers/administration.controller');

// Consultation réservée à l'administrateur (CU-23)
const paiements = Router();
paiements.use(authenticate, authorize('administrateur'));
paiements.get('/', validate({ query: schemas.paiementListQuery }), controller.listPaiements);

const audit = Router();
audit.use(authenticate, authorize('administrateur'));
audit.get('/', validate({ query: schemas.auditListQuery }), controller.listAudit);

module.exports = { paiements, audit };