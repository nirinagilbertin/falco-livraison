import { AbstractControl, FormGroup } from '@angular/forms';
import { AppError } from '../../core/models/api.model';

function normalize(details: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(details)) {
    for (const d of details as any[]) {
      const field = d?.champ ?? d?.field ?? d?.path ?? d?.param;
      const msg = d?.message ?? d?.msg;
      if (field && msg) out[String(field)] ??= String(msg);
    }
  } else if (details && typeof details === 'object') {
    for (const [k, v] of Object.entries(details)) {
      out[k] = Array.isArray(v) ? String(v[0]) : String(v);
    }
  }
  return out;
}

/** Place les messages du backend sous les champs du formulaire. Gère les chemins imbriqués (ex. colis.0.poids_estime). */
export function applyServerErrors(form: FormGroup, error: AppError): void {
  for (const [name, message] of Object.entries(normalize(error.details))) {
    const ctrl = form.get(name);
    if (ctrl) {
      ctrl.setErrors({ server: message });
      ctrl.markAsTouched();
    }
  }
}

/** Message à afficher sous un champ, ou null. */
export function fieldError(ctrl: AbstractControl | null): string | null {
  if (!ctrl || !ctrl.errors || !(ctrl.touched || ctrl.dirty)) return null;
  const e = ctrl.errors;
  if (e['server']) return e['server'];
  if (e['required']) return 'Champ obligatoire';
  if (e['email']) return 'Adresse e-mail invalide';
  if (e['minlength']) return `Minimum ${e['minlength'].requiredLength} caractères`;
  if (e['min']) return `Valeur minimale : ${e['min'].min}`;
  return 'Valeur invalide';
}