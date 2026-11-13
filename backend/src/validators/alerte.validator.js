const { z } = require('zod');
const { paginationQuery } = require('./common.validator');

const alertListQuery = paginationQuery.extend({
  statut: z.enum(['nouvelle', 'en_cours', 'resolue']).optional(),
  niveau_priorite: z.enum(['faible', 'moyen', 'eleve']).optional(),
  type_alerte: z
    .enum(['retard', 'refus_mission', 'absence_reponse', 'aucun_livreur', 'livraison_inachevee', 'incident', 'autre'])
    .optional(),
  id_livraison: z.coerce.number().int().positive().optional(),
});

const notificationListQuery = paginationQuery.extend({
  statut: z.enum(['non_lue', 'lue']).optional(),
});

module.exports = { alertListQuery, notificationListQuery };