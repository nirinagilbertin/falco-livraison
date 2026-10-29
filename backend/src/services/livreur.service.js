const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { getPagination, buildMeta } = require('../utils/pagination');
const { hashPassword } = require('../utils/password');
const { generateTemporaryPassword } = require('../utils/tempPassword');
const compteRepository = require('../repositories/compte.repository');
const livreurRepository = require('../repositories/livreur.repository');
const utilisateurRepository = require('../repositories/utilisateur.repository');
const vehiculeRepository = require('../repositories/vehicule.repository');
const auditService = require('./audit.service');

const SUBJECT = 'livreur';

// Toutes les zones demandées doivent exister et être actives
const ensureZonesUsable = async (zoneIds) => {
  const found = await livreurRepository.findZonesByIds(zoneIds);
  if (found.length !== zoneIds.length) throw AppError.badRequest('Une ou plusieurs zones sont introuvables');
  if (found.some((z) => z.statut !== 'active')) throw AppError.badRequest('Une ou plusieurs zones sont inactives');
};

// Le véhicule habituel doit exister et ne pas être hors service
const ensureVehiculeUsable = async (id_vehicule) => {
  const vehicule = await vehiculeRepository.findById(id_vehicule);
  if (!vehicule) throw AppError.badRequest('Véhicule introuvable');
  if (vehicule.statut === 'hors_service') throw AppError.badRequest('Ce véhicule est hors service');
};

const toDetail = (row, permis, zones) => {
  const {
    id_vehicule, immatriculation, marque, modele, type_vehicule, capacite_poids, vehicule_statut,
    mot_de_passe_temporaire, ...livreur
  } = row;
  return {
    ...livreur,
    mot_de_passe_temporaire: Boolean(mot_de_passe_temporaire),
    id_vehicule,
    vehicule: id_vehicule
      ? { id_vehicule, immatriculation, marque, modele, type_vehicule, capacite_poids, statut: vehicule_statut }
      : null,
    permis,
    zones,
  };
};

const list = async (query) => {
  const pagination = getPagination(query);
  const { items, total } = await livreurRepository.list(query, pagination);
  return { items, meta: buildMeta(pagination, total) };
};

const getById = async (id) => {
  const row = await livreurRepository.findById(id);
  if (!row) throw AppError.notFound('Livreur introuvable');
  const [permis, zones] = await Promise.all([livreurRepository.findPermis(id), livreurRepository.findZones(id)]);
  return toDetail(row, permis, zones);
};

// CU-10 : création du compte livreur (mot de passe temporaire) et de son profil
const create = async (user, data) => {
  if (await compteRepository.existsByEmail(data.email)) throw AppError.conflict('Cette adresse e-mail est déjà utilisée');
  if (await compteRepository.existsByUsername(data.nom_utilisateur)) throw AppError.conflict("Ce nom d'utilisateur est déjà utilisé");
  if (await livreurRepository.findByCin(data.cin)) throw AppError.conflict('Un livreur avec ce CIN existe déjà');
  await ensureZonesUsable(data.zones);
  if (data.id_vehicule) await ensureVehiculeUsable(data.id_vehicule);

  const mot_de_passe_initial = generateTemporaryPassword();
  const mot_de_passe_hash = await hashPassword(mot_de_passe_initial);

  const id = await withTransaction(async (conn) => {
    const id_compte = await compteRepository.create(conn, {
      email: data.email,
      nom_utilisateur: data.nom_utilisateur,
      mot_de_passe_hash,
      role: 'livreur',
      mot_de_passe_temporaire: 1,
    });
    const id_livreur = await livreurRepository.create(conn, {
      id_compte, nom: data.nom, prenom: data.prenom, telephone: data.telephone, cin: data.cin, id_vehicule: data.id_vehicule ?? null,
    });
    await livreurRepository.replacePermis(conn, id_livreur, data.permis);
    await livreurRepository.replaceZones(conn, id_livreur, data.zones);
    await auditService.log(
      { id_compte: user.id_compte, action: 'creation', type_objet: SUBJECT, id_objet: id_livreur, details: `${data.prenom} ${data.nom}` },
      conn
    );
    return id_livreur;
  });

  // Le mot de passe temporaire n'est affiché qu'une seule fois, à la création
  return { ...(await getById(id)), mot_de_passe_initial };
};

const update = async (user, id, data) => {
  const existing = await livreurRepository.findById(id);
  if (!existing) throw AppError.notFound('Livreur introuvable');

  if (data.cin !== undefined && data.cin !== existing.cin && (await livreurRepository.findByCin(data.cin, id))) {
    throw AppError.conflict('Un livreur avec ce CIN existe déjà');
  }
  if (data.zones) await ensureZonesUsable(data.zones);
  if (data.id_vehicule !== undefined && data.id_vehicule !== existing.id_vehicule) {
    if (existing.disponibilite === 'occupe') {
      throw AppError.conflict('Ce livreur est en mission : son véhicule habituel ne peut pas être changé pour le moment');
    }
    if (data.id_vehicule !== null) await ensureVehiculeUsable(data.id_vehicule);
  }

  await withTransaction(async (conn) => {
    const { permis, zones, ...fields } = data;
    await livreurRepository.update(conn, id, fields);
    if (permis) await livreurRepository.replacePermis(conn, id, permis);
    if (zones) await livreurRepository.replaceZones(conn, id, zones);
    await auditService.log(
      { id_compte: user.id_compte, action: 'modification', type_objet: SUBJECT, id_objet: id, details: `champs=${Object.keys(data).join(',')}` },
      conn
    );
  });
  return getById(id);
};

// Suppression du livreur et de son compte s'il n'a aucun historique ; sinon désactivation (CU-10, A2)
const remove = async (user, id) => {
  const existing = await livreurRepository.findById(id);
  if (!existing) throw AppError.notFound('Livreur introuvable');
  if (existing.disponibilite === 'occupe') {
    throw AppError.conflict('Ce livreur est en mission : suppression impossible pour le moment');
  }
  const label = `${existing.prenom} ${existing.nom}`;

  try {
    await withTransaction(async (conn) => {
      await auditService.log({ id_compte: user.id_compte, action: 'suppression', type_objet: SUBJECT, id_objet: id, details: label }, conn);
      await utilisateurRepository.deleteAccount(conn, { id_compte: existing.id_compte, role: 'livreur' });
    });
    return { supprime: true, desactive: false };
  } catch (err) {
    if (err.code !== 'ER_ROW_IS_REFERENCED_2') throw err;
  }

  await withTransaction(async (conn) => {
    await utilisateurRepository.updateStatut(conn, existing.id_compte, 'suspendu');
    await livreurRepository.update(conn, id, { disponibilite: 'hors_service' });
    await auditService.log({ id_compte: user.id_compte, action: 'desactivation', type_objet: SUBJECT, id_objet: id, details: label }, conn);
  });
  return { supprime: false, desactive: true };
};

module.exports = { list, getById, create, update, remove };