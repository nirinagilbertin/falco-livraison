const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { getPagination, buildMeta } = require('../utils/pagination');
const vehiculeRepository = require('../repositories/vehicule.repository');
const zoneRepository = require('../repositories/zone.repository');
const auditService = require('./audit.service');

const SUBJECT = 'vehicule';

// La zone de rattachement doit exister et être active
const ensureZoneUsable = async (id_zone) => {
  const zone = await zoneRepository.findById(id_zone);
  if (!zone) throw AppError.badRequest('Zone introuvable');
  if (zone.statut !== 'active') throw AppError.badRequest('Cette zone est inactive');
};

const ensureImmatriculationAvailable = async (immatriculation, excludeId) => {
  if (await vehiculeRepository.findByImmatriculation(immatriculation, excludeId)) {
    throw AppError.conflict('Un véhicule avec cette immatriculation existe déjà');
  }
};

const list = async (query) => {
  const pagination = getPagination(query);
  const { items, total } = await vehiculeRepository.list(query, pagination);
  return { items, meta: buildMeta(pagination, total) };
};

const getById = async (id) => {
  const vehicule = await vehiculeRepository.findById(id);
  if (!vehicule) throw AppError.notFound('Véhicule introuvable');
  const livreurs = await vehiculeRepository.findLivreurs(id);
  return { ...vehicule, livreurs };
};

const create = async (user, data) => {
  await ensureZoneUsable(data.id_zone);
  await ensureImmatriculationAvailable(data.immatriculation);

  const id = await withTransaction(async (conn) => {
    const id_vehicule = await vehiculeRepository.create(conn, data);
    await auditService.log(
      { id_compte: user.id_compte, action: 'creation', type_objet: SUBJECT, id_objet: id_vehicule, details: `immatriculation=${data.immatriculation}` },
      conn
    );
    return id_vehicule;
  });
  return getById(id);
};

const update = async (user, id, data) => {
  const existing = await vehiculeRepository.findById(id);
  if (!existing) throw AppError.notFound('Véhicule introuvable');

  if (data.statut !== undefined && existing.statut === 'en_service') {
    throw AppError.conflict('Véhicule en service : son statut ne peut pas être modifié pour le moment');
  }
  if (data.immatriculation !== undefined && data.immatriculation !== existing.immatriculation) {
    await ensureImmatriculationAvailable(data.immatriculation, id);
  }
  if (data.id_zone !== undefined && data.id_zone !== existing.id_zone) {
    await ensureZoneUsable(data.id_zone);
  }

  await withTransaction(async (conn) => {
    await vehiculeRepository.update(conn, id, data);
    await auditService.log(
      { id_compte: user.id_compte, action: 'modification', type_objet: SUBJECT, id_objet: id, details: `champs=${Object.keys(data).join(',')}` },
      conn
    );
  });
  return getById(id);
};

// Suppression si le véhicule n'a aucun historique ; sinon mise « hors service » (CU-10, A2)
const remove = async (user, id) => {
  const existing = await vehiculeRepository.findById(id);
  if (!existing) throw AppError.notFound('Véhicule introuvable');
  if (existing.statut === 'en_service') {
    throw AppError.conflict('Véhicule en service : suppression impossible pour le moment');
  }

  try {
    await withTransaction(async (conn) => {
      await vehiculeRepository.remove(conn, id);
      await auditService.log(
        { id_compte: user.id_compte, action: 'suppression', type_objet: SUBJECT, id_objet: id, details: `immatriculation=${existing.immatriculation}` },
        conn
      );
    });
    return { supprime: true, desactive: false };
  } catch (err) {
    if (err.code !== 'ER_ROW_IS_REFERENCED_2') throw err;
  }

  const livreurs = await vehiculeRepository.findLivreurs(id);
  if (livreurs.length > 0) {
    throw AppError.conflict(`Ce véhicule est le véhicule habituel de ${livreurs.length} livreur(s) : réassignez-les d'abord`);
  }
  if (existing.statut !== 'hors_service') {
    await withTransaction(async (conn) => {
      await vehiculeRepository.update(conn, id, { statut: 'hors_service' });
      await auditService.log(
        { id_compte: user.id_compte, action: 'desactivation', type_objet: SUBJECT, id_objet: id, details: `immatriculation=${existing.immatriculation}` },
        conn
      );
    });
  }
  return { supprime: false, desactive: true };
};

module.exports = { list, getById, create, update, remove };