const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { getPagination, buildMeta } = require('../utils/pagination');
const depotRepository = require('../repositories/depot.repository');
const zoneRepository = require('../repositories/zone.repository');
const auditService = require('./audit.service');

const SUBJECT = 'depot';

const list = async (query) => {
  const pagination = getPagination(query);
  const { items, total } = await depotRepository.list(query, pagination);
  return { items, meta: buildMeta(pagination, total) };
};

const getById = async (id) => {
  const depot = await depotRepository.findById(id);
  if (!depot) throw AppError.notFound('Dépôt introuvable');
  const { items: zones } = await zoneRepository.list({ id_depot: id }, { limit: 100, offset: 0 });
  return { ...depot, zones };
};

const create = async (user, data) => {
  const id = await withTransaction(async (conn) => {
    const id_depot = await depotRepository.create(conn, data);
    await auditService.log(
      { id_compte: user.id_compte, action: 'creation', type_objet: SUBJECT, id_objet: id_depot, details: `nom=${data.nom}` },
      conn
    );
    return id_depot;
  });
  return getById(id);
};

const update = async (user, id, data) => {
  const existing = await depotRepository.findById(id);
  if (!existing) throw AppError.notFound('Dépôt introuvable');

  if (data.statut === 'inactif' && existing.statut !== 'inactif' && (await zoneRepository.countActiveByDepot(id)) > 0) {
    throw AppError.conflict('Ce dépôt dessert des zones actives : réaffectez ou désactivez-les avant de le désactiver');
  }

  await withTransaction(async (conn) => {
    await depotRepository.update(conn, id, data);
    await auditService.log(
      { id_compte: user.id_compte, action: 'modification', type_objet: SUBJECT, id_objet: id, details: `champs=${Object.keys(data).join(',')}` },
      conn
    );
  });
  return getById(id);
};

// Suppression si le dépôt n'est lié à rien ; sinon désactivation (CU-10, A2)
const remove = async (user, id) => {
  const existing = await depotRepository.findById(id);
  if (!existing) throw AppError.notFound('Dépôt introuvable');

  try {
    await withTransaction(async (conn) => {
      await depotRepository.remove(conn, id);
      await auditService.log(
        { id_compte: user.id_compte, action: 'suppression', type_objet: SUBJECT, id_objet: id, details: `nom=${existing.nom}` },
        conn
      );
    });
    return { supprime: true, desactive: false };
  } catch (err) {
    if (err.code !== 'ER_ROW_IS_REFERENCED_2') throw err;
  }

  if ((await zoneRepository.countActiveByDepot(id)) > 0) {
    throw AppError.conflict('Ce dépôt dessert des zones actives : réaffectez ou désactivez-les avant de le supprimer');
  }
  if (existing.statut !== 'inactif') {
    await withTransaction(async (conn) => {
      await depotRepository.update(conn, id, { statut: 'inactif' });
      await auditService.log(
        { id_compte: user.id_compte, action: 'desactivation', type_objet: SUBJECT, id_objet: id, details: `nom=${existing.nom}` },
        conn
      );
    });
  }
  return { supprime: false, desactive: true };
};

module.exports = { list, getById, create, update, remove };