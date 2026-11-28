import { ValidatorFn } from '@angular/forms';

export const sameAs =
    (a: string, b: string): ValidatorFn =>
        (group) => (group.get(a)?.value === group.get(b)?.value ? null : { mismatch: true });

/** Nombre de chiffres compris entre min et max (espaces et séparateurs ignorés). */
export const nbChiffres =
  (min: number, max: number): ValidatorFn =>
  (c) => {
    const n = String(c.value ?? '').replace(/\D/g, '').length;
    return n >= min && n <= max ? null : { chiffres: true };
  };