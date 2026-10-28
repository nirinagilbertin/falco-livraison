const { z } = require('zod');
const { paginationQuery, q } = require('./common.validator');

const carburant = z.enum(['essence', 'diesel', 'electrique', 'hybride', 'autre']);
// « en_service » est géré uniquement par le déroulement des livraisons, jamais à la main
const statutManuel = z.enum(['disponible', 'en_maintenance', 'hors_service'], {
  error: 'Statut invalide : disponible, en_maintenance ou hors_service',
});
const idZone = z.coerce.number().int().positive();

const base = z.object({
  id_zone: idZone,
  immatriculation: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .transform((v) => v.toUpperCase().replace(/\s+/g, ' ')),
  marque: z.string().trim().min(1).max(50),
  modele: z.string().trim().min(1).max(50),
  type_vehicule: z.string().trim().min(2).max(30).transform((v) => v.toLowerCase()),
  carburant,
  capacite_poids: z.coerce.number().positive('La capacité doit être positive').max(999999.99),
});

const create = base.extend({ statut: statutManuel.optional() });
const update = base
  .extend({ statut: statutManuel })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Aucun champ à modifier' });
const listQuery = paginationQuery.extend({
  statut: z.enum(['disponible', 'en_service', 'en_maintenance', 'hors_service']).optional(),
  id_zone: idZone.optional(),
  type_vehicule: z.string().trim().max(30).optional().transform((v) => (v ? v.toLowerCase() : undefined)),
  q,
});

module.exports = { create, update, listQuery };