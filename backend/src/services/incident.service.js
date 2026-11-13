const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { getPagination, buildMeta } = require('../utils/pagination');
const incidentRepository = require('../repositories/incident.repository');
const profilRepository = require('../repositories/profil.repository');
const notificationService = require('./notification.service');
const auditService = require('./audit.service');

const STAFF = ['administrateur', 'gestionnaire', 'superviseur'];

// Gravité : une alerte liée est créée pour tous les types sauf « autre »
const GRAVITE = {
  accident: 'eleve',
  colis_endommage: 'moyen',
  colis_non_conforme: 'moyen',
  adresse_incorrecte: 'faible',
  expediteur_absent: 'faible',
  retard: 'faible',
};

const LABELS = {
  colis_non_conforme: 'colis non conforme', adresse_incorrecte: 'adresse incorrecte', expediteur_absent: 'expéditeur absent',
  colis_endommage: 'colis endommagé', retard: 'retard', accident: 'accident', autre: 'autre',
};

// CU-18 : le livreur ou l'expéditeur concerné déclare un incident rattaché à une livraison
const declare = async (user, { id_livraison, type_incident, description }) => {
  const access = await incidentRepository.findLivraisonAccess(id_livraison);
  if (!access) throw AppError.notFound('Livraison introuvable');

  const isSender = user.role === 'expediteur' && access.expediteur_id_compte === user.id_compte;
  const isCourier = user.role === 'livreur' && access.livreur_id_compte === user.id_compte;
  if (!isSender && !isCourier) throw AppError.forbidden('Cette livraison ne vous concerne pas');

  const id = await withTransaction(async (conn) => {
    const id_incident = await incidentRepository.create(conn, { id_livraison, id_declarant: user.id_compte, type_incident, description });
    await auditService.log(
      { id_compte: user.id_compte, action: 'creation', type_objet: 'incident', id_objet: id_incident, details: `${access.numero_suivi} : ${type_incident}` },
      conn
    );
    await notificationService.notifyRoles(conn, ['gestionnaire'], {
      type: 'incident',
      libelle: `Nouvel incident (${LABELS[type_incident]}) sur ${access.numero_suivi} : ${description.slice(0, 120)}`,
      id_livraison,
    });

    const niveau_priorite = GRAVITE[type_incident];
    if (niveau_priorite) {
      await incidentRepository.createAlert(conn, {
        id_livraison, id_incident, niveau_priorite, libelle: `Incident (${LABELS[type_incident]}) sur ${access.numero_suivi}`,
      });
      // Le gestionnaire est déjà notifié de l'incident ; l'alerte prévient le superviseur (et l'administrateur si grave)
      await notificationService.notifyRoles(conn, niveau_priorite === 'eleve' ? ['superviseur', 'administrateur'] : ['superviseur'], {
        type: 'alerte', libelle: `Alerte : incident (${LABELS[type_incident]}) sur ${access.numero_suivi}`, id_livraison,
      });
    }
    return id_incident;
  });
  return getById(user, id);
};

const list = async (user, query) => {
  const pagination = getPagination(query);
  // Un livreur ou un expéditeur ne voit que les incidents qu'il a déclarés
  const scope = STAFF.includes(user.role) ? null : user.id_compte;
  const { items, total } = await incidentRepository.list(query, pagination, scope);
  return { items, meta: buildMeta(pagination, total) };
};

const getById = async (user, id) => {
  const incident = await incidentRepository.findById(id);
  if (!incident) throw AppError.notFound('Incident introuvable');
  if (!STAFF.includes(user.role) && incident.id_declarant !== user.id_compte) throw AppError.forbidden('Accès refusé à cet incident');
  return { ...incident, alertes: await incidentRepository.findAlerts(id) };
};

// CU-19 : le gestionnaire prend l'incident en charge (Nouveau -> En cours)
const takeOver = async (user, id) => {
  const manager = await profilRepository.findByCompte(user.role, user.id_compte);

  await withTransaction(async (conn) => {
    const locked = await incidentRepository.lockById(conn, id);
    if (!locked) throw AppError.notFound('Incident introuvable');
    if (locked.statut !== 'nouveau') throw AppError.conflict(`Cet incident est déjà ${locked.statut === 'en_cours' ? 'pris en charge' : 'résolu'}`);

    const incident = await incidentRepository.findById(id, conn);
    await incidentRepository.takeOver(conn, id, manager ? manager.id_utilisateur : null);
    await incidentRepository.syncAlertsTakeOver(conn, id, manager ? manager.id_utilisateur : null);
    await auditService.log({ id_compte: user.id_compte, action: 'prise_en_charge', type_objet: 'incident', id_objet: id, details: incident.numero_suivi }, conn);
    await notificationService.notifyAccount(conn, {
      id_compte: locked.id_declarant, type: 'incident',
      libelle: `Votre incident sur ${incident.numero_suivi} est pris en charge`, id_livraison: incident.id_livraison,
    });
  });
  return getById(user, id);
};

// CU-19 : clôture (En cours -> Résolu). Sans clôture, l'incident reste « En cours » (A1).
const resolve = async (user, id, commentaire) => {
  await withTransaction(async (conn) => {
    const locked = await incidentRepository.lockById(conn, id);
    if (!locked) throw AppError.notFound('Incident introuvable');
    if (locked.statut === 'nouveau') throw AppError.conflict("Prenez d'abord l'incident en charge");
    if (locked.statut === 'resolu') throw AppError.conflict('Cet incident est déjà résolu');

    const incident = await incidentRepository.findById(id, conn);
    await incidentRepository.resolve(conn, id);
    await incidentRepository.syncAlertsResolve(conn, id);
    await auditService.log(
      { id_compte: user.id_compte, action: 'resolution', type_objet: 'incident', id_objet: id, details: `${incident.numero_suivi}${commentaire ? ` : ${commentaire}` : ''}` },
      conn
    );
    await notificationService.notifyAccount(conn, {
      id_compte: locked.id_declarant, type: 'incident',
      libelle: `Votre incident sur ${incident.numero_suivi} est résolu${commentaire ? ` : ${commentaire}` : ''}`.slice(0, 255),
      id_livraison: incident.id_livraison,
    });
  });
  return getById(user, id);
};

module.exports = { declare, list, getById, takeOver, resolve };