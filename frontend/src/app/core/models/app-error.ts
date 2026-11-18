import { HttpErrorResponse } from '@angular/common/http';
import { AppError } from './api.model';

export function toAppError(err: HttpErrorResponse): AppError {
  if (err.status === 0) {
    return { status: 0, code: 'NETWORK_ERROR', message: 'Serveur injoignable. Vérifiez la connexion.' };
  }
  const e = err.error?.error;
  return {
    status: err.status,
    code: e?.code ?? 'UNKNOWN_ERROR',
    message: e?.message ?? 'Une erreur est survenue.',
    details: e?.details,
  };
}