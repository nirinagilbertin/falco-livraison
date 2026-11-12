const { z } = require('zod');

const dimension = z.coerce.number().positive().max(9999.99);

// CU-14 : poids réel et dimensions constatés pour chaque colis
const verify = z.object({
  colis: z
    .array(
      z.object({
        id_colis: z.coerce.number().int().positive(),
        poids_reel: z.coerce.number().positive('Le poids doit être positif').max(99999.99),
        longueur: dimension.optional(),
        largeur: dimension.optional(),
        hauteur: dimension.optional(),
      })
    )
    .min(1, 'Au moins un colis'),
});

// CU-16 : personne ayant reçu le colis et méthode de vérification (le CIN n'est jamais enregistré)
const deliver = z.object({
  id_destinataire: z.coerce.number().int().positive(),
  methode_verification: z.enum(['cin', 'telephone'], { error: 'Méthode invalide : cin ou telephone' }),
});

const fail = z.object({
  motif_type: z.enum(['verification_echouee', 'destinataire_absent', 'autre'], {
    error: 'Motif invalide : verification_echouee, destinataire_absent ou autre',
  }),
  detail: z.string().trim().max(200).optional(),
});

// CU-13 : dépôt (par défaut, le dépôt de la zone de récupération)
const deposit = z.object({ id_depot: z.coerce.number().int().positive().optional() });

module.exports = { verify, deliver, fail, deposit };