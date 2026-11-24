type Montant = number | string;

export interface DemandeListe {
  id_demande: number;
  numero_suivi: string;
  statut: string;
  adresse_recuperation: string;
  adresse_livraison: string;
  distance_estimee: Montant;
  frais_estimes: Montant;
  frais_definitifs: Montant | null;
  date_creation: string;
  id_expediteur: number;
  expediteur_nom: string;
  type_expediteur: string;
  id_livraison: number | null;
  statut_livraison: string | null;
  nb_colis: number;
}

export interface ColisFiche {
  id_colis: number;
  libelle: string;
  description: string | null;
  poids_estime: Montant;
  poids_reel: Montant | null;
  longueur: Montant | null;
  largeur: Montant | null;
  hauteur: Montant | null;
  instructions: string | null;
  statut: string;
}

export interface DestinataireFiche {
  id_destinataire: number;
  nom: string;
  prenom: string | null;
  telephone: string;
  est_principal: boolean | number;
}

export interface HistoriqueFiche {
  ancien_statut: string | null;
  nouveau_statut: string;
  motif: string | null;
  date_changement: string;
}

export interface DemandeFiche {
  id_demande: number;
  numero_suivi: string;
  statut: string;
  adresse_recuperation: string;
  adresse_livraison: string;
  distance_estimee: Montant;
  frais_estimes: Montant;
  frais_definitifs: Montant | null;
  poids_total_estime?: Montant;
  date_creation: string;
  date_verification: string | null;
  date_validation: string | null;
  date_annulation: string | null;
  motif_annulation: string | null;
  expediteur?: { nom_complet?: string; nom_utilisateur?: string; telephone?: string; type_expediteur?: string } | null;
  zone_recuperation?: { nom_zone?: string; ville?: string } | string | null;
  colis: ColisFiche[];
  destinataires: DestinataireFiche[];
  livraison?: { id_livraison: number; statut: string; motif_inachevement?: string | null } | null;
  historique?: HistoriqueFiche[];
}