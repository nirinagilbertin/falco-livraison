import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { toAppError } from '../models/app-error';
import { NotifyService } from '../services/notify.service';
import { TokenService } from '../services/token.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = inject(TokenService);
  const notify = inject(NotifyService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const e = toAppError(err);
      const isLogin = req.url.endsWith('/auth/login');

      if (e.status === 401 && !isLogin) {
        token.clear();
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