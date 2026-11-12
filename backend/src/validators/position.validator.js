const { z } = require('zod');
const { latitude, longitude } = require('./common.validator');

const share = z.object({ latitude, longitude });

const bool = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

const listQuery = z.object({
  disponibilite: z.enum(['libre', 'occupe', 'hors_service']).optional(),
  avec_position: bool,
});

const trackQuery = z.object({ limit: z.coerce.number().int().min(1).max(5000).default(1000) });

module.exports = { share, listQuery, trackQuery };