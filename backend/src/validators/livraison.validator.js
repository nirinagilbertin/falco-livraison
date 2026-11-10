const { z } = require('zod');
const { paginationQuery, q } = require('./common.validator');

const listQuery = paginationQuery.extend({
  statut: z.enum(['en_attente', 'affectee', 'en_cours', 'terminee', 'inachevee', 'annulee']).optional(),
  // true : livraisons en attente sans aucune proposition en cours (à traiter par le gestionnaire)
  sans_livreur: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  q,
});

const assign = z.object({ id_livreur: z.coerce.number().int().positive() });

module.exports = { listQuery, assign };