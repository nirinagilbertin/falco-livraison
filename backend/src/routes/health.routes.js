const { Router } = require('express');
const { success } = require('../utils/response');
const healthController = require('../controllers/health.controller');

const router = Router();

router.get('/', (req, res) =>
  success(res, {
    service: 'falco-livraison-api',
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
);

router.get('/db', healthController.checkDatabase);

module.exports = router;
