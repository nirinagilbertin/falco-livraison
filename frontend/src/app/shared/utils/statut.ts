export type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

export function severiteStatut(s: string): Severity {
  switch (s) {
    case 'actif':
    case 'active':
    case 'disponible':
      return 'success';
    case 'en_service':
      return 'info';
    case 'en_maintenance':
      return 'warn';
    case 'inactif':
    case 'inactive':
    case 'hors_service':
      return 'danger';
    default:
      return 'secondary';
  }
}

export function labelStatut(s: string): string {
  const t = s.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}