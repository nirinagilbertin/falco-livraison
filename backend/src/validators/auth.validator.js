const { z } = require('zod');
const { email, telephone } = require('./common.validator');

// Au moins 8 caractères, une lettre et un chiffre
const motDePasse = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(72, 'Le mot de passe ne doit pas dépasser 72 caractères')
  .regex(/[A-Za-z]/, 'Le mot de passe doit contenir au moins une lettre')
  .regex(/\d/, 'Le mot de passe doit contenir au moins un chiffre');

const nomUtilisateur = z
  .string()
  .trim()
  .min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères")
  .max(50)
  .regex(/^[A-Za-z0-9._-]+$/, "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, point, tiret et underscore");

const register = z
  .object({
    email,
    nom_utilisateur: nomUtilisateur,
    mot_de_passe: motDePasse,
    type_expediteur: z.enum(['client', 'entreprise', 'fournisseur', 'commercant'], {
      error: 'Type invalide : client, entreprise, fournisseur ou commercant',
    }),
    nom_complet: z.string().trim().min(2, 'Nom requis').max(150),
    telephone,
    adresse: z.string().trim().max(255).optional(),
    secteur: z.string().trim().min(2).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type_expediteur === 'client' && data.secteur) {
      ctx.addIssue({ code: 'custom', path: ['secteur'], message: "Le secteur d'activité est réservé aux partenaires commerciaux" });
    }
    if (data.type_expediteur !== 'client' && !data.secteur) {
      ctx.addIssue({ code: 'custom', path: ['secteur'], message: "Le secteur d'activité est obligatoire pour un partenaire commercial" });
    }
  });

const login = z.object({
  email,
  mot_de_passe: z.string().min(1, 'Mot de passe requis'),
});

const changePassword = z
  .object({
    ancien_mot_de_passe: z.string().min(1, 'Ancien mot de passe requis'),
    nouveau_mot_de_passe: motDePasse,
  })
  .refine((d) => d.ancien_mot_de_passe !== d.nouveau_mot_de_passe, {
    path: ['nouveau_mot_de_passe'],
    message: "Le nouveau mot de passe doit être différent de l'ancien",
  });

module.exports = { register, login, changePassword, motDePasse, nomUtilisateur };