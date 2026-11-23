export type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

export function severiteStatut(s: string): Severity {
  switch (s) {
    case 'actif':
      return 'success';
    case 'active':
      return 'success';
    case 'disponible':
      return 'success';
    case 'libre':
      return 'success';
    case 'en_service':
      return 'info';
    case 'occupe':
      return 'warn';
    case 'en_maintenance':
      return 'warn';
    case 'inactif':
      return 'danger';
    case 'inactive':
      return 'danger';
    case 'hors_service':
      return 'danger';
    case 'suspendu':
      return 'danger';
    default:
      return 'secondary';
  }
}

export function labelStatut(s: string): string {
  const t = s.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}