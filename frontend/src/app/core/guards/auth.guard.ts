import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models/auth.model';
import { AuthService } from '../services/auth.service';

/** Connecté et mot de passe définitif. */
export const authGuard: CanActivateFn = (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const compte = auth.compte();
    if (!compte) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    if (compte.mot_de_passe_temporaire) return router.createUrlTree(['/changer-mot-de-passe']);
    return true;
};

/** Connecté, même avec un mot de passe temporaire. */
export const sessionGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};

/** Pages publiques (connexion, inscription) : inaccessibles si déjà connecté. */
export const guestGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    return auth.isLoggedIn() ? inject(Router).createUrlTree(['/']) : true;
};

/** Restreint une route à certains rôles. */
export const roleGuard =
    (...roles: Role[]): CanActivateFn =>
        () => {
            const role = inject(AuthService).role();
            return role && roles.includes(role) ? true : inject(Router).createUrlTree(['/']);
        };