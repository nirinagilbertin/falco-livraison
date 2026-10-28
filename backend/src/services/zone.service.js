const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { getPagination, buildMeta } = require('../utils/pagination');
const zoneRepository = require('../repositories/zone.repository');
const depotRepository = require('../repositories/depot.repository');
const auditService = require('./audit.service');

const SUBJECT = 'zone';

// Le dépôt de rattachement doit exister et être actif
const ensureDepotUsable = async (id_depot) => {
  const depot = await depotRepository.findById(id_depot);
  if (!depot) throw AppError.badRequest('Dépôt introuvable');
  if (depot.statut !== 'actif') throw AppError.badRequest('Ce dépôt est inactif');
};

const ensureNameAvailable = async (nom_zone, ville, excludeId) => {
  if (await zoneRepository.findByNameAndCity(nom_zone, ville, excludeId)) {
    throw AppError.conflict('Une zone portant ce nom existe déjà dans cette ville');
  }
};

const list = async (query) => {
  const pagination = getPagination(query);
  const { items, total } = await zoneRepository.list(query, pagination);
  return { items, meta: buildMeta(pagination, total) };
};

const getById = async (id) => {
  const zone = await zoneRepository.findById(id);
  if (!zone) throw AppError.notFound('Zone introuvable');
  return zone;
};

const create = async (user, data) => {
  await ensureDepotUsable(data.id_depot);
  await ensureNameAvailable(data.nom_zone, data.ville);

  const id = await withTransaction(async (conn) => {
    const id_zone = await zoneRepository.create(conn, data);
    await auditService.log(
      { id_compte: user.id_compte, action: 'creation', type_objet: SUBJECT, id_objet: id_zone, details: `${data.nom_zone} (${data.ville})` },
      conn
    );
    return id_zone;
  });
  return getById(id);
};

const update = async (user, id, data) => {
  const existing = await zoneRepository.findById(id);
  if (!existing) throw AppError.notFound('Zone introuvable');

  if (data.nom_zone !== undefined || data.ville !== undefined) {
    await ensureNameAvailable(data.nom_zone ?? existing.nom_zone, data.ville ?? existing.ville, id);
  }
  if (data.id_depot !== undefined && data.id_depot !== existing.id_depot) {
    await ensureDepotUsable(data.id_depot);
  }

  await withTransaction(async (conn) => {
    await zoneRepository.update(conn, id, data);
    await auditService.log(
      { id_compte: user.id_compte, action: 'modification', type_objet: SUBJECT, id_objet: id, details: `champs=${Object.keys(data).join(',')}` },
      conn
    );
  });
  return getById(id);
};

// Suppression si la zone n'est liée à rien ; sinon désactivation (CU-10, A2)
const remove = async (user, id) => {
  const existing = await zoneRepository.findById(id);
  if (!existing) throw AppError.notFound('Zone introuvable');

  try {
    await withTransaction(async (conn) => {
      await zoneRepository.remove(conn, id);
      await auditService.log(
        { id_compte: user.id_compte, action: 'suppression', type_objet: SUBJECT, id_objet: id, details: `${existing.nom_zone} (${existing.ville})` },
        conn
      );
    });
    return { supprime: true, desactive: false };
  } catch (err) {
    if (err.code !== 'ER_ROW_IS_REFERENCED_2') throw err;
  }

  if (existing.statut !== 'inactive') {
    await withTransaction(async (conn) => {
      await zoneRepository.update(conn, id, { statut: 'inactive' });
      await auditService.log(
        { id_compte: user.id_compte, action: 'desactivation', type_objet: SUBJECT, id_objet: id, details: `${existing.nom_zone} (${existing.ville})` },
        conn
      );
    });
  }
  return { supprime: false, desactive: true };
};

module.exports = { list, getById, create, update, remove };