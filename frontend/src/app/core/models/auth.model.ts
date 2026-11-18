export type Role = 'administrateur' | 'gestionnaire' | 'superviseur' | 'livreur' | 'expediteur';
export type TypeExpediteur = 'client' | 'entreprise' | 'fournisseur' | 'commercant';

export interface Compte {
  id_compte: number;
  email: string;
  nom_utilisateur: string;
  role: Role;
  statut: 'actif' | 'suspendu';
  mot_de_passe_temporaire: boolean;
  photo_profil: string | null;
  date_creation: string;
  derniere_connexion: string | null;
}

export interface LoginResponse {
  token: string;
  expires_in: number;
  compte: Compte;
}

export type MeResponse = Partial<Compte> & {
  compte?: Compte;
  profil?: Record<string, unknown> | null;
};

export interface RegisterPayload {
  type_expediteur: TypeExpediteur;
  nom_complet: string;
  secteur: string;
  email: string;
  nom_utilisateur: string;
  telephone: string;
  adresse?: string;
  mot_de_passe: string;
}