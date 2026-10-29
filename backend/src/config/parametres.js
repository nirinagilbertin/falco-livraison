const { z } = require('zod');

const entier = (min, max, label) =>
  z.coerce
    .number({ error: `${label} : nombre entier attendu` })
    .int(`${label} : nombre entier attendu`)
    .min(min, `${label} : minimum ${min}`)
    .max(max, `${label} : maximum ${max}`);

// Registre des paramètres modifiables : valeur par défaut, règle de validation et rôles autorisés.
// Seules ces clés existent pour l'API ; la table `parametre` stocke les valeurs.
const PARAMETRES = {
  jour_livraison_commune: {
    defaut: 6,
    description: 'Jour de la semaine (1=lundi ... 7=dimanche) de redistribution des livraisons inachevées',
    schema: entier(1, 7, 'Jour de la semaine (1 à 7)'),
    roles: ['administrateur', 'gestionnaire'],
  },
  delai_reponse_livreur_min: {
    defaut: 15,
    description: "Minutes sans réponse avant expiration d'une proposition de mission",
    schema: entier(1, 1440, 'Délai en minutes'),
    roles: ['administrateur'],
  },
  delai_paiement_min: {
    defaut: 30,
    description: "Minutes laissées à l'expéditeur pour payer après vérification du colis, avant annulation",
    schema: entier(1, 1440, 'Délai en minutes'),
    roles: ['administrateur'],
  },
};

module.exports = { PARAMETRES };