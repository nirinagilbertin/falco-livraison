const { z } = require('zod');
const { DEFAULT_LIMIT, MAX_LIMIT } = require('../utils/pagination');

// :id dans l'URL (entier positif)
const idParam = z.object({
  id: z.coerce.number().int().positive('Identifiant invalide'),
});

// ?page=1&limit=20
const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

// Recherche texte ?q=... (une chaîne vide est ignorée)
const q = z.string().trim().max(100).optional().transform((v) => v || undefined);
// Champs réutilisables
const email = z.string().trim().toLowerCase().email('E-mail invalide').max(150);
const telephone = z.string().trim().min(6, 'Téléphone invalide').max(20);
const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

module.exports = { idParam, paginationQuery, q, email, telephone, latitude, longitude };