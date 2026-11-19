export interface Depot {
  id_depot: number;
  nom: string;
  adresse: string;
  latitude: number;
  longitude: number;
  statut: 'actif' | 'inactif';
}

export interface Zone {
  id_zone: number;
  id_depot: number;
  nom_zone: string;
  description: string | null;
  ville: string;
  limites_geographiques: unknown | null;
  statut: 'active' | 'inactive';
}

export interface Vehicule {
  id_vehicule: number;
  id_zone: number;
  immatriculation: string;
  marque: string;
  modele: string;
  type_vehicule: string;
  carburant: 'essence' | 'diesel' | 'electrique' | 'hybride' | 'autre';
  capacite_poids: number;
  statut: 'disponible' | 'en_service' | 'en_maintenance' | 'hors_service';
}