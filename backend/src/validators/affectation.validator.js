const { z } = require('zod');
const { paginationQuery } = require('./common.validator');

const refuse = z.object({ motif: z.string().trim().max(150).optional() });

const listQuery = paginationQuery.extend({
  statut: z.enum(['en_attente', 'acceptee', 'refusee', 'expiree', 'annulee']).optional(),
});

module.exports = { refuse, listQuery };