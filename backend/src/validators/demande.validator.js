const { z } = require('zod');
const { paginationQuery, q, telephone, latitude, longitude } = require('./common.validator');

const poids = z.coerce.number().positive('Le poids doit être positif').max(99999.99);
const dimension = z.coerce.number().positive().max(9999.99);

const colis = z.object({
  libelle: z.string().trim().min(1, 'Nature du colis requise').max(100),
  description: z.string().trim().max(2000).optional(),
  emballage: z.string().trim().max(100).optional(),
  poids_estime: poids,
  longueur: dimension.optional(),
  largeur: dimension.optional(),
  hauteur: dimension.optional(),
  instructions: z.string().trim().max(2000).optional(),
});

// Personne de vérification du destinataire (sans compte)
const destinataire = z.object({
  nom: z.string().trim().min(1).max(80),
  prenom: z.string().trim().min(1).max(80).optional(),
  telephone,
  est_principal: z.boolean().optional(),
});

const adresse = z.string().trim().min(3).max(255);

const create = z
  .object({
    adresse_recuperation: adresse,
    latitude_recuperation: latitude,
    longitude_recuperation: longitude,
    adresse_livraison: adresse,
    latitude_livraison: latitude,
    longitude_livraison: longitude,
    colis: z.array(colis).min(1, 'Au moins un colis').max(20),
    destinataires: z.array(destinataire).min(1, 'Au moins une personne de vérification').max(5),
  })
  .superRefine((d, ctx) => {
    if (d.destinataires.filter((x) => x.est_principal).length > 1) {
      ctx.addIssue({ code: 'custom', path: ['destinataires'], message: 'Un seul destinataire principal est possible' });
    }
    if (d.latitude_recuperation === d.latitude_livraison && d.longitude_recuperation === d.longitude_livraison) {
      ctx.addIssue({ code: 'custom', path: ['adresse_livraison'], message: 'Les adresses de récupération et de livraison sont identiques' });
    }
  });

const cancel = z.object({ motif: z.string().trim().max(255).optional() });

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');

const listQuery = paginationQuery.extend({
  statut: z.enum(['en_attente', 'en_cours', 'verifiee', 'validee', 'annulee']).optional(),
  id_expediteur: z.coerce.number().int().positive().optional(),
  du: date.optional(),
  au: date.optional(),
  q,
});

module.exports = { create, cancel, listQuery };