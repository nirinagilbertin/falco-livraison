const { Router } = require('express');
const { success } = require('../utils/response');

const router = Router();

router.get('/', (req, res) =>
  success(res, {
    service: 'falco-livraison-api',
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
);

module.exports = router;
