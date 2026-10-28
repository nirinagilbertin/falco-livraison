const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Transforme { page, limit } en { page, limit, offset } sécurisés
const getPagination = ({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {}) => {
  const safePage = Math.max(1, Number(page) || DEFAULT_PAGE);
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT));
  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
};

// Métadonnées renvoyées avec une liste paginée
const buildMeta = ({ page, limit }, total) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

module.exports = { getPagination, buildMeta, DEFAULT_LIMIT, MAX_LIMIT };