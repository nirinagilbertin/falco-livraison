const { z } = require('zod');
const { paginationQuery, q } = require('./common.validator');

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');
const ordered = (o) => !o.du || !o.au || o.du <= o.au;
const orderedMessage = { message: 'La date de début doit précéder la date de fin', path: ['du'] };

// Période : par défaut, les 30 derniers jours
const periodQuery = z.object({ du: date.optional(), au: date.optional() }).refine(ordered, orderedMessage);

const evolutionQuery = z
  .object({ du: date.optional(), au: date.optional(), pas: z.enum(['jour', 'mois']).default('jour') })
  .refine(ordered, orderedMessage);

const paiementListQuery = paginationQuery
  .extend({
    statut: z.enum(['en_cours', 'valide', 'echoue', 'annule']).optional(),
    mode_paiement: z.enum(['carte', 'mobile_money']).optional(),
    id_expediteur: z.coerce.number().int().positive().optional(),
    du: date.optional(),
    au: date.optional(),
    q,
  })
  .refine(ordered, orderedMessage);

const auditListQuery = paginationQuery
  .extend({
    id_compte: z.coerce.number().int().positive().optional(),
    action: z.string().trim().max(50).optional().transform((v) => v || undefined),
    type_objet: z.string().trim().max(50).optional().transform((v) => v || undefined),
    id_objet: z.coerce.number().int().positive().optional(),
    du: date.optional(),
    au: date.optional(),
    q,
  })
  .refine(ordered, orderedMessage);

module.exports = { periodQuery, evolutionQuery, paiementListQuery, auditListQuery };