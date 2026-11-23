import { Compte, Role } from './auth.model';

export interface CompteListe {
  id_compte: number;
  email: string;
  nom_utilisateur: string;
  role: Role;
  statut: 'actif' | 'suspendu';
  mot_de_passe_temporaire: boolean;
  date_creation: string;
  derniere_connexion: string | null;
  nom_complet?: string;
  type_expediteur?: string;
  nom?: string;
  prenom?: string;
  telephone?: string;
}

export interface CreationCompteReponse {
  compte: Compte;
  profil: Record<string, unknown>;
  mot_de_passe_initial: string;
}

export interface LivreurListe {
  id_livreur: number;
  id_compte: number;
  email: string;
  statut_compte: string;
  nom: string;
  prenom: string;
  telephone: string;
  cin: string;
  disponibilite: 'libre' | 'occupe' | 'hors_service';
  id_vehicule: number | null;
  immatriculation: string | null;
  permis: string[];
  nb_zones: number;
}

export interface LivreurDetail {
  id_livreur: number;
  id_compte: number;
  email: string;
  nom_utilisateur: string;
  statut_compte: string;
  nom: string;
  prenom: string;
  telephone: string;
  cin: string;
  disponibilite: string;
  id_vehicule: number | null;
  vehicule: { id_vehicule: number; immatriculation: string } | null;
  permis: string[];
  zones: { id_zone: number; nom_zone: string; ville: string; statut: string }[];
  mot_de_passe_initial?: string;
}