const { Router } = require('express');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/alerte.validator');
const controller = require('../controllers/notificationBox.controller');

const router = Router();

// Chaque utilisateur ne voit que ses propres notifications
router.use(authenticate);

router.get('/', validate({ query: schemas.notificationListQuery }), controller.list);
router.post('/lire-tout', controller.markAllRead);
router.post('/:id/lire', validate({ params: idParam }), controller.markRead);

module.exports = router;