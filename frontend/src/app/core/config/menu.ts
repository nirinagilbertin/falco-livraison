import { Role } from '../models/auth.model';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles: Role[];
  exact?: boolean;
}

export const ROLE_LABELS: Record<Role, string> = {
  administrateur: 'Administrateur',
  gestionnaire: 'Gestionnaire',
  superviseur: 'Superviseur',
  livreur: 'Livreur',
  expediteur: 'Partenaire commercial',
};

const ALL: Role[] = ['administrateur', 'gestionnaire', 'superviseur', 'expediteur'];
const ADMIN: Role[] = ['administrateur'];
const ADMIN_GEST: Role[] = ['administrateur', 'gestionnaire'];
const STAFF: Role[] = ['administrateur', 'gestionnaire', 'superviseur'];

export const MENU: NavItem[] = [
  { label: 'Tableau de bord', icon: 'pi-home', route: '/', roles: ALL, exact: true },
  { label: 'Nouvelle demande', icon: 'pi-plus-circle', route: '/demandes/nouvelle', roles: ['expediteur'] },
  { label: 'Demandes', icon: 'pi-box', route: '/demandes', roles: ALL },
  { label: 'Livraisons', icon: 'pi-send', route: '/livraisons', roles: STAFF },
  { label: 'Carte de suivi', icon: 'pi-map', route: '/carte', roles: STAFF },
  { label: 'Incidents', icon: 'pi-exclamation-circle', route: '/incidents', roles: [...STAFF, 'expediteur'] },
  { label: 'Alertes', icon: 'pi-bell', route: '/alertes', roles: STAFF },
  { label: 'Utilisateurs', icon: 'pi-users', route: '/utilisateurs', roles: ADMIN },
  { label: 'Livreurs', icon: 'pi-id-card', route: '/livreurs', roles: ADMIN_GEST },
  { label: 'Véhicules', icon: 'pi-car', route: '/vehicules', roles: ADMIN_GEST },
  { label: 'Zones', icon: 'pi-map-marker', route: '/zones', roles: ADMIN_GEST },
  { label: 'Dépôts', icon: 'pi-building', route: '/depots', roles: ADMIN_GEST },
  { label: 'Paiements', icon: 'pi-wallet', route: '/paiements', roles: ADMIN },
  { label: 'Statistiques', icon: 'pi-chart-bar', route: '/statistiques', roles: [...STAFF, 'expediteur'] },
  { label: 'Configuration', icon: 'pi-cog', route: '/configuration', roles: ADMIN_GEST },
  { label: "Journal d'audit", icon: 'pi-history', route: '/audit', roles: ADMIN },
];