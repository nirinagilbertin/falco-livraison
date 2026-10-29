const { z } = require('zod');
const { paginationQuery, q, email, telephone } = require('./common.validator');
const { nomUtilisateur } = require('./auth.validator');

const dedupe = (arr) => [...new Set(arr)];

// CIN : espaces retirés, majuscules, 6 à 20 caractères alphanumériques
const cin = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{6,20}$/, 'CIN invalide (6 à 20 caractères alphanumériques)'));

const permis = z
  .array(
    z.string().trim().min(1).max(5).regex(/^[A-Za-z0-9]+$/, 'Catégorie de permis invalide').transform((v) => v.toUpperCase())
  )
  .min(1, 'Au moins une catégorie de permis')
  .max(10)
  .transform(dedupe);

const zones = z
  .array(z.coerce.number().int().positive())
  .min(1, "Au moins une zone d'intervention")
  .max(50)
  .transform(dedupe);

const idVehicule = z.coerce.number().int().positive().nullable();
const nom = z.string().trim().min(1).max(80);

const create = z.object({
  email,
  nom_utilisateur: nomUtilisateur,
  nom,
  prenom: nom,
  telephone,
  cin,
  permis,
  zones,
  id_vehicule: idVehicule.optional(),
});

const update = z
  .object({ nom, prenom: nom, telephone, cin, permis, zones, id_vehicule: idVehicule })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Aucun champ à modifier' });

const listQuery = paginationQuery.extend({
  disponibilite: z.enum(['libre', 'occupe', 'hors_service']).optional(),
  statut: z.enum(['actif', 'suspendu']).optional(),
  id_zone: z.coerce.number().int().positive().optional(),
  q,
});

module.exports = { create, update, listQuery };