const AppError = require('../utils/AppError');
const { getPagination, buildMeta } = require('../utils/pagination');
const repository = require('../repositories/notificationBox.repository');

// Liste de mes notifications, avec le nombre de notifications non lues dans la méta
const list = async (user, query) => {
  const pagination = getPagination(query);
  const { items, total } = await repository.list(user.id_compte, query, pagination);
  return { items, meta: { ...buildMeta(pagination, total), non_lues: await repository.countUnread(user.id_compte) } };
};

const markRead = async (user, id) => {
  const notification = await repository.findOwn(user.id_compte, id);
  if (!notification) throw AppError.notFound('Notification introuvable');
  if (notification.statut === 'non_lue') await repository.markRead(user.id_compte, id);
  return { id_notification: id, statut: 'lue' };
};

const markAllRead = async (user) => ({ marquees: await repository.markAllRead(user.id_compte) });

module.exports = { list, markRead, markAllRead };