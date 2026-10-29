const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { PARAMETRES } = require('../config/parametres');
const parametreRepository = require('../repositories/parametre.repository');
const auditService = require('./audit.service');

const toDto = (cle, row) => ({
  cle,
  valeur: row ? Number(row.valeur) : PARAMETRES[cle].defaut,
  description: row ? row.description : PARAMETRES[cle].description,
  date_modification: row ? row.date_modification : null,
  modifiable_par: PARAMETRES[cle].roles,
});

const list = async () => {
  const rows = await parametreRepository.list();
  const byKey = Object.fromEntries(rows.map((r) => [r.cle, r]));
  return Object.keys(PARAMETRES).map((cle) => toDto(cle, byKey[cle]));
};

const getOne = async (cle) => {
  if (!PARAMETRES[cle]) throw AppError.notFound('Paramètre inconnu');
  return toDto(cle, await parametreRepository.findByKey(cle));
};

// Valeur numérique d'un paramètre, avec repli sur la valeur par défaut (pour les autres services)
const getInt = async (cle) => {
  const row = await parametreRepository.findByKey(cle);
  const value = row ? Number(row.valeur) : NaN;
  return Number.isFinite(value) ? value : PARAMETRES[cle].defaut;
};

const update = async (user, cle, valeur) => {
  const def = PARAMETRES[cle];
  if (!def) throw AppError.notFound('Paramètre inconnu');
  if (!def.roles.includes(user.role)) {
    throw AppError.forbidden(`Ce paramètre ne peut être modifié que par : ${def.roles.join(', ')}`);
  }

  const current = await getOne(cle);
  if (current.valeur === valeur) return current;

  await withTransaction(async (conn) => {
    await parametreRepository.upsert(conn, { cle, valeur: String(valeur), description: def.description });
    await auditService.log(
      { id_compte: user.id_compte, action: 'modification', type_objet: 'parametre', details: `${cle} : ${current.valeur} -> ${valeur}` },
      conn
    );
  });
  return getOne(cle);
};

module.exports = { list, getOne, getInt, update };