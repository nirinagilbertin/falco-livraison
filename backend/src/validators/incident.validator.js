const { z } = require('zod');
const { paginationQuery } = require('./common.validator');

const TYPES = ['colis_non_conforme', 'adresse_incorrecte', 'expediteur_absent', 'colis_endommage', 'retard', 'accident', 'autre'];
const STATUTS = ['nouveau', 'en_cours', 'resolu'];

const declare = z.object({
  id_livraison: z.coerce.number().int().positive(),
  type_incident: z.enum(TYPES, { error: `Type invalide : ${TYPES.join(', ')}` }),
  description: z.string().trim().min(3, 'Description requise').max(2000),
});

const resolve = z.object({ commentaire: z.string().trim().max(200).optional() });

const listQuery = paginationQuery.extend({
  statut: z.enum(STATUTS).optional(),
  type_incident: z.enum(TYPES).optional(),
  id_livraison: z.coerce.number().int().positive().optional(),
});

module.exports = { declare, resolve, listQuery, TYPES };