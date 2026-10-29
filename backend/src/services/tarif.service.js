const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { getPagination, buildMeta } = require('../utils/pagination');
const { computeBreakdown } = require('../utils/pricing');
const tarifRepository = require('../repositories/tarif.repository');
const profilRepository = require('../repositories/profil.repository');
const auditService = require('./audit.service');

const SUBJECT = 'tarif';

const list = async (query) => {
  const pagination = getPagination(query);
  const { items, total } = await tarifRepository.list(query, pagination);
  return { items, meta: buildMeta(pagination, total) };
};

const getById = async (id) => {
  const tarif = await tarifRepository.findById(id);
  if (!tarif) throw AppError.notFound('Tarif introuvable');
  return tarif;
};

// Tarif actif ou null
const getActive = () => tarifRepository.findActive();

// Tarif actif, sinon erreur : à utiliser pour tout calcul de frais (CU-22, A2)
const getActiveOrFail = async () => {
  const tarif = await tarifRepository.findActive();
  if (!tarif) throw new AppError('Aucun tarif actif : impossible de calculer les frais', 409, 'NO_ACTIVE_TARIFF');
  return tarif;
};

// CU-22 : création d'un tarif, éventuellement activé aussitôt
const create = async (user, data) => {
  // tarif.id_utilisateur référence le profil interne, pas le compte
  const profil = await profilRepository.findByCompte(user.role, user.id_compte);

  const id = await withTransaction(async (conn) => {
    const id_tarif = await tarifRepository.create(conn, {
      frais_base: data.frais_base,
      prix_par_km: data.prix_par_km,
      prix_par_kg: data.prix_par_kg,
      id_utilisateur: profil ? profil.id_utilisateur : null,
    });
    await auditService.log(
      {
        id_compte: user.id_compte, action: 'creation', type_objet: SUBJECT, id_objet: id_tarif,
        details: `base=${data.frais_base}, km=${data.prix_par_km}, kg=${data.prix_par_kg}`,
      },
      conn
    );
    if (data.activer) {
      await tarifRepository.deactivateAll(conn);
      await tarifRepository.activate(conn, id_tarif);
      await auditService.log({ id_compte: user.id_compte, action: 'activation', type_objet: SUBJECT, id_objet: id_tarif }, conn);
    }
    return id_tarif;
  });
  return getById(id);
};

// Le tarif actif précédent est désactivé ; les demandes déjà créées gardent leurs frais (R15)
const activate = async (user, id) => {
  const tarif = await getById(id);
  if (tarif.actif) throw AppError.conflict('Ce tarif est déjà le tarif actif');

  await withTransaction(async (conn) => {
    await tarifRepository.deactivateAll(conn);
    await tarifRepository.activate(conn, id);
    await auditService.log({ id_compte: user.id_compte, action: 'activation', type_objet: SUBJECT, id_objet: id }, conn);
  });
  return getById(id);
};

// Estimation des frais avec le tarif actif (utile pour l'affichage avant la demande)
const simulate = async ({ distance, poids }) => {
  const tarif = await getActiveOrFail();
  const detail = computeBreakdown(tarif, distance, poids);
  return {
    tarif: { id_tarif: tarif.id_tarif, frais_base: tarif.frais_base, prix_par_km: tarif.prix_par_km, prix_par_kg: tarif.prix_par_kg },
    distance_km: distance,
    poids_kg: poids,
    ...detail,
  };
};

module.exports = { list, getById, getActive, getActiveOrFail, create, activate, simulate };