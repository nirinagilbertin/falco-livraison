type Montant = number | string;

export interface Paiement {
  id_paiement: number;
  id_demande: number;
  montant: Montant;
  mode_paiement: 'carte' | 'mobile_money';
  statut: 'en_cours' | 'valide' | 'echoue' | 'annule';
  carte_derniers_chiffres: string | null;
  titulaire_carte: string | null;
  operateur_mobile: string | null;
  numero_payeur: string | null;
  reference_paiement: string;
  numero_recu: string | null;
  motif_echec: string | null;
  date_creation: string;
  date_paiement: string | null;
}

export interface Recu {
  numero_recu: string;
  reference_paiement: string;
  date_paiement: string;
  numero_suivi: string;
  expediteur?: string;
  montant: Montant;
  mode_paiement: string;
}

export interface RecapPaiements {
  id_demande: number;
  numero_suivi: string;
  statut: string;
  frais_estimes: Montant;
  frais_definitifs: Montant | null;
  delai_paiement_min: number;
  paiement_avant: string | null;
  tentatives: Paiement[];
}

export interface PaiementResultat {
  paiement: Paiement;
  recu: Recu;
}