import { ValidatorFn } from '@angular/forms';

export const sameAs =
    (a: string, b: string): ValidatorFn =>
        (group) => (group.get(a)?.value === group.get(b)?.value ? null : { mismatch: true });