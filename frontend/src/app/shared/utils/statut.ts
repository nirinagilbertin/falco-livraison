export type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

export function severiteStatut(s: string): Severity {
  switch (s) {
    case 'actif':
    case 'active':
    case 'disponible':
    case 'libre':
    case 'validee':
    case 'terminee':
    case 'acceptee':
      return 'success';
    case 'en_service':
    case 'en_cours':
    case 'verifiee':
    case 'affectee':
      return 'info';
    case 'en_maintenance':
    case 'occupe':
    case 'en_attente':
    case 'inachevee':
      return 'warn';
    case 'inactif':
    case 'inactive':
    case 'hors_service':
    case 'suspendu':
    case 'annulee':
    case 'refusee':
      return 'danger';
    default:
      return 'secondary';
  }
}

export function labelStatut(s: string): string {
  const t = s.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}