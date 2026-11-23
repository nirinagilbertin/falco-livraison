export interface Tarif {
  id_tarif: number;
  frais_base: number | string;
  prix_par_km: number | string;
  prix_par_kg: number | string;
  actif: boolean | number;
  date_creation: string;
  id_utilisateur: number | null;
}

export interface Parametre {
  cle: string;
  valeur: string | number;
  description?: string | null;
  date_modification?: string;
}