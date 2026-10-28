const { z } = require('zod');
const { paginationQuery, q } = require('./common.validator');

const statut = z.enum(['active', 'inactive']);
const idDepot = z.coerce.number().int().positive();

// Polygone GeoJSON facultatif
const limites = z.object({
  type: z.enum(['Polygon', 'MultiPolygon'], { error: 'Type GeoJSON attendu : Polygon ou MultiPolygon' }),
  coordinates: z.array(z.any()).min(1, 'Coordonnées requises'),
});

const base = z.object({
  id_depot: idDepot,
  nom_zone: z.string().trim().min(2).max(100),
  ville: z.string().trim().min(2).max(100),
  description: z.string().trim().max(255).nullable().optional(),
  limites_geographiques: limites.nullable().optional(),
});

const create = base;
const update = base
  .extend({ statut })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Aucun champ à modifier' });
const listQuery = paginationQuery.extend({
  statut: statut.optional(),
  id_depot: idDepot.optional(),
  ville: z.string().trim().max(100).optional().transform((v) => v || undefined),
  q,
});

module.exports = { create, update, listQuery };