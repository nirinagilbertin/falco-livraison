const alerteRepository = require('../repositories/alerte.repository');
const notificationService = require('./notification.service');

// Crée une alerte (anomalie détectée par le système) et notifie les responsables.
// dedupe = true : pas de nouvelle alerte si une alerte du même type est déjà ouverte pour cette livraison.
const raise = async (conn, { id_livraison = null, type_alerte, libelle, niveau_priorite = 'moyen', notifier = [], dedupe = false }) => {
  if (dedupe && id_livraison && (await alerteRepository.existsOpen(conn, id_livraison, type_alerte))) return null;
  const id_alerte = await alerteRepository.create(conn, { id_livraison, type_alerte, libelle, niveau_priorite });
  if (notifier.length) await notificationService.notifyRoles(conn, notifier, { type: 'alerte', libelle, id_livraison });
  return id_alerte;
};

module.exports = { raise };