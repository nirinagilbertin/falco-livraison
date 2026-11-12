const { z } = require('zod');

// Seule la forme des champs est contrôlée ici. Les informations fausses ou non conformes
// (numéro invalide, carte expirée...) ne sont pas des erreurs de saisie : elles produisent un paiement « échoué ».
const carte = z.object({
  mode_paiement: z.literal('carte'),
  numero_carte: z.string().trim().min(1).max(30),
  titulaire: z.string().trim().min(2).max(100),
  expiration: z.string().trim().min(1).max(10),
  cryptogramme: z.string().trim().min(1).max(6),
});

const mobileMoney = z.object({
  mode_paiement: z.literal('mobile_money'),
  operateur: z.string().trim().min(1).max(50),
  numero: z.string().trim().min(1).max(20),
});

const pay = z.discriminatedUnion('mode_paiement', [carte, mobileMoney], {
  error: 'Mode de paiement invalide : carte ou mobile_money',
});

module.exports = { pay };