const { z } = require('zod');
const { telephone } = require('./common.validator');

const notEmpty = { message: 'Aucun champ à modifier' };
const hasFields = (o) => Object.keys(o).length > 0;

// Champs modifiables selon le rôle ; tout autre champ est refusé (.strict)
const interne = z
  .object({
    nom: z.string().trim().min(1).max(80),
    prenom: z.string().trim().min(1).max(80),
    telephone,
  })
  .partial()
  .strict()
  .refine(hasFields, notEmpty);

const livreur = z.object({ telephone }).partial().strict().refine(hasFields, notEmpty);

const expediteur = z
  .object({
    nom_complet: z.string().trim().min(2).max(150),
    telephone,
    adresse: z.string().trim().max(255).nullable(),
    secteur: z.string().trim().min(2).max(100).nullable(),
  })
  .partial()
  .strict()
  .refine(hasFields, notEmpty);

const byRole = {
  administrateur: interne,
  gestionnaire: interne,
  superviseur: interne,
  livreur,
  expediteur,
};

module.exports = { byRole };