import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { toAppError } from '../models/app-error';
import { NotifyService } from '../services/notify.service';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const notify = inject(NotifyService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const e = toAppError(err);
      const isAuthForm = req.url.endsWith('/auth/login') || req.url.endsWith('/auth/change-password');

      if (e.status === 401 && !isAuthForm) {
        if (e.code === 'TOKEN_EXPIRED') notify.warn('Session expirée, veuillez vous reconnecter.');
        auth.clearSession();
        router.navigate(['/login']);
      } else if (e.code === 'PASSWORD_CHANGE_REQUIRED') {
        router.navigate(['/changer-mot-de-passe']);
      } else if (e.status === 0 || e.status >= 500 || e.status === 403 || e.status === 429) {
        notify.error(e.message);
      }
      // 400, 404, 409 : gérés par le composant appelant
      return throwError(() => e);
    }),
  );
};