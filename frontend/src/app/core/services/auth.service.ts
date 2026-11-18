import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, map, Observable, of, switchMap, throwError } from 'rxjs';
import { AppError } from '../models/api.model';
import { Compte, LoginResponse, MeResponse, RegisterPayload, Role } from '../models/auth.model';
import { ApiService } from './api.service';
import { TokenService } from './token.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private tokens = inject(TokenService);
  private router = inject(Router);

  readonly compte = signal<Compte | null>(null);
  readonly profil = signal<Record<string, unknown> | null>(null);
  readonly role = computed<Role | null>(() => this.compte()?.role ?? null);
  readonly isLoggedIn = computed(() => !!this.compte());

  login(email: string, mot_de_passe: string): Observable<Compte> {
    return this.api.post<LoginResponse>('/auth/login', { email, mot_de_passe }).pipe(
      switchMap((res) => {
        if (res.compte.role === 'livreur') {
          const err: AppError = {
            status: 403,
            code: 'WEB_NOT_ALLOWED',
            message: "Cet espace est réservé au personnel et aux partenaires. Utilisez l'application mobile.",
          };
          return throwError(() => err);
        }
        this.tokens.set(res.token);
        return this.loadMe();
      }),
    );
  }

  register(payload: RegisterPayload) {
    return this.api.post<unknown>('/auth/register', payload);
  }

  changePassword(ancien_mot_de_passe: string, nouveau_mot_de_passe: string) {
    return this.api.post<unknown>('/auth/change-password', { ancien_mot_de_passe, nouveau_mot_de_passe });
  }

  loadMe(): Observable<Compte> {
    return this.api.get<MeResponse>('/auth/me').pipe(
      map((d) => {
        const compte = (d.compte ?? d) as Compte;
        this.compte.set(compte);
        this.profil.set(d.profil ?? null);
        return compte;
      }),
    );
  }

  /** Appelé au démarrage de l'application. */
  restore(): Promise<void> {
    if (!this.tokens.get()) return Promise.resolve();
    return firstValueFrom(
      this.loadMe().pipe(
        catchError(() => {
          this.clearSession();
          return of(null);
        }),
      ),
    ).then(() => undefined);
  }

  clearSession(): void {
    this.tokens.clear();
    this.compte.set(null);
    this.profil.set(null);
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }
}