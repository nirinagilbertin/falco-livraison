const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { getPagination, buildMeta } = require('../utils/pagination');
const alerteRepository = require('../repositories/alerteSuivi.repository');
const incidentRepository = require('../repositories/incident.repository');
const profilRepository = require('../repositories/profil.repository');
const auditService = require('./audit.service');

const list = async (query) => {
  const pagination = getPagination(query);
  const { items, total } = await alerteRepository.list(query, pagination);
  return { items, meta: buildMeta(pagination, total) };
};

const getById = async (id) => {
  const alerte = await alerteRepository.findById(id);
  if (!alerte) throw AppError.notFound('Alerte introuvable');
  const incident = alerte.id_incident ? await incidentRepository.findById(alerte.id_incident) : null;
  return { ...alerte, incident };
};

// CU-19 : prise en charge (Nouvelle -> En cours)
const takeOver = async (user, id) => {
  const manager = await profilRepository.findByCompte(user.role, user.id_compte);

  await withTransaction(async (conn) => {
    const locked = await alerteRepository.lockById(conn, id);
    if (!locked) throw AppError.notFound('Alerte introuvable');
    if (locked.statut !== 'nouvelle') throw AppError.conflict(`Cette alerte est déjà ${locked.statut === 'en_cours' ? 'prise en charge' : 'résolue'}`);

    await alerteRepository.takeOver(conn, id, manager ? manager.id_utilisateur : null);
    await auditService.log({ id_compte: user.id_compte, action: 'prise_en_charge', type_objet: 'alerte', id_objet: id }, conn);
  });
  return getById(id);
};

// CU-19 : résolution (En cours -> Résolue), date de résolution conservée
const resolve = async (user, id) => {
  await withTransaction(async (conn) => {
    const locked = await alerteRepository.lockById(conn, id);
    if (!locked) throw AppError.notFound('Alerte introuvable');
    if (locked.statut === 'nouvelle') throw AppError.conflict("Prenez d'abord l'alerte en charge");
    if (locked.statut === 'resolue') throw AppError.conflict('Cette alerte est déjà résolue');

    await alerteRepository.resolve(conn, id);
    await auditService.log({ id_compte: user.id_compte, action: 'resolution', type_objet: 'alerte', id_objet: id }, conn);
  });
  return getById(id);
};

module.exports = { list, getById, takeOver, resolve };