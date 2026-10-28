const { z } = require('zod');
const { paginationQuery, q, latitude, longitude } = require('./common.validator');

const statut = z.enum(['actif', 'inactif']);

const base = z.object({
  nom: z.string().trim().min(2).max(100),
  adresse: z.string().trim().min(3).max(255),
  latitude,
  longitude,
});

const create = base;
const update = base
  .extend({ statut })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Aucun champ à modifier' });
const listQuery = paginationQuery.extend({ statut: statut.optional(), q });

module.exports = { create, update, listQuery };