const { executor } = require('../config/db');
const { buildWhere, buildLimit } = require('../utils/sql');

const list = async (id_compte, { statut }, pagination) => {
  const clauses = ['id_compte = :id_compte'];
  const params = { id_compte };
  if (statut) { clauses.push('statut = :statut'); params.statut = statut; }
  const where = buildWhere(clauses);
  const run = executor();

  const items = await run(
    `SELECT id_notification, type, libelle, id_livraison, statut, date_creation, date_lecture
     FROM notification ${where} ORDER BY date_creation DESC, id_notification DESC ${buildLimit(pagination)}`,
    params
  );
  const [{ total }] = await run(`SELECT COUNT(*) AS total FROM notification ${where}`, params);
  return { items, total };
};

const countUnread = async (id_compte) => {
  const [{ total }] = await executor()("SELECT COUNT(*) AS total FROM notification WHERE id_compte = :id_compte AND statut = 'non_lue'", { id_compte });
  return total;
};

const findOwn = async (id_compte, id_notification) => {
  const rows = await executor()(
    'SELECT id_notification, statut FROM notification WHERE id_notification = :id_notification AND id_compte = :id_compte',
    { id_notification, id_compte }
  );
  return rows[0] || null;
};

const markRead = (id_compte, id_notification) =>
  executor()(
    "UPDATE notification SET statut = 'lue', date_lecture = NOW() WHERE id_notification = :id_notification AND id_compte = :id_compte AND statut = 'non_lue'",
    { id_notification, id_compte }
  );

const markAllRead = async (id_compte) => {
  const result = await executor()(
    "UPDATE notification SET statut = 'lue', date_lecture = NOW() WHERE id_compte = :id_compte AND statut = 'non_lue'",
    { id_compte }
  );
  return result.affectedRows;
};

module.exports = { list, countUnread, findOwn, markRead, markAllRead };