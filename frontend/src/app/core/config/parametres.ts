export type TypeParametre = 'jour' | 'nombre' | 'texte';

export const PARAMETRES: Record<string, { label: string; unite?: string; type: TypeParametre; aide?: string }> = {
  jour_livraison_commune: {
    label: 'Jour de livraison commune',
    type: 'jour',
    aide: 'Jour de redistribution des livraisons inachevées. Prend effet au prochain cycle.',
  },
  delai_reponse_livreur_min: {
    label: 'Délai de réponse du livreur',
    unite: 'min',
    type: 'nombre',
    aide: 'Au-delà, la proposition de mission expire.',
  },
  delai_paiement_min: {
    label: 'Délai de paiement',
    unite: 'min',
    type: 'nombre',
    aide: 'Temps laissé à l\'expéditeur pour payer après la vérification du colis.',
  },
};

export const JOURS = [
  { label: 'Lundi', value: 1 },
  { label: 'Mardi', value: 2 },
  { label: 'Mercredi', value: 3 },
  { label: 'Jeudi', value: 4 },
  { label: 'Vendredi', value: 5 },
  { label: 'Samedi', value: 6 },
  { label: 'Dimanche', value: 7 },
];