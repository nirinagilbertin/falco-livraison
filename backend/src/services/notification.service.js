const notificationRepository = require('../repositories/notification.repository');

// Notification interne à l'application (aucun canal externe : ni SMS, ni e-mail, ni push)
const notifyAccount = (conn, payload) => notificationRepository.create(conn, payload);

const notifyRoles = async (conn, roles, payload) => {
  const ids = await notificationRepository.findAccountIdsByRoles(conn, roles);
  for (const id_compte of ids) await notificationRepository.create(conn, { ...payload, id_compte });
  return ids.length;
};

module.exports = { notifyAccount, notifyRoles };