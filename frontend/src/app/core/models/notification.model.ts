export interface AppNotification {
  id_notification: number;
  type: string;
  libelle: string;
  id_livraison: number | null;
  statut: 'non_lue' | 'lue';
  date_creation: string;
  date_lecture: string | null;
}