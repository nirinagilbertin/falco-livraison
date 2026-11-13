const { getPagination, buildMeta } = require('../utils/pagination');
const administrationRepository = require('../repositories/administration.repository');

const listPaiements = async (query) => {
  const pagination = getPagination(query);
  const { items, total, totalValide } = await administrationRepository.listPaiements(query, pagination);
  // total_valide : somme des paiements validés correspondant aux filtres (toutes pages confondues)
  return { items, meta: { ...buildMeta(pagination, total), total_valide: Number(totalValide) } };
};

const listAudit = async (query) => {
  const pagination = getPagination(query);
  const { items, total } = await administrationRepository.listAudit(query, pagination);
  return { items, meta: buildMeta(pagination, total) };
};

module.exports = { listPaiements, listAudit };