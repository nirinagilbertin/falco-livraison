const { z } = require('zod');
const { paginationQuery } = require('./common.validator');

const montant = z.coerce.number().min(0, 'Le montant ne peut pas être négatif').max(9999999999.99);

const create = z.object({
  frais_base: montant,
  prix_par_km: montant,
  prix_par_kg: montant,
  // true : le tarif devient immédiatement le tarif actif (l'ancien est désactivé)
  activer: z.boolean().optional(),
});

const listQuery = paginationQuery.extend({
  actif: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
});

const simulationQuery = z.object({
  distance: z.coerce.number().min(0, 'La distance ne peut pas être négative').max(100000),
  poids: z.coerce.number().positive('Le poids doit être positif').max(100000),
});

module.exports = { create, listQuery, simulationQuery };