const { Router } = require('express');

const router = Router();

router.use('/health', require('./health.routes'));
// Les routes métier seront ajoutées étape par étape :
router.use('/auth', require('./auth.routes'));
router.use('/depots', require('./depot.routes'));
router.use('/zones', require('./zone.routes'));
router.use('/vehicules', require('./vehicule.routes'));
router.use('/utilisateurs', require('./utilisateur.routes'));
router.use('/livreurs', require('./livreur.routes'));
router.use('/profil', require('./profil.routes'));
router.use('/tarifs', require('./tarif.routes'));
router.use('/parametres', require('./parametre.routes'));
router.use('/demandes', require('./demande.routes'));

module.exports = router;
