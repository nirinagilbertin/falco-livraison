const { Router } = require('express');

const router = Router();

router.use('/health', require('./health.routes'));
// Les routes métier seront ajoutées étape par étape :
router.use('/auth', require('./auth.routes'));

module.exports = router;
