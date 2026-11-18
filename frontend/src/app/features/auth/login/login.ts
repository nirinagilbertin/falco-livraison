import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { AppError } from '../../../core/models/api.model';
import { AuthService } from '../../../core/services/auth.service';
import { AuthCard } from '../../../shared/components/auth-card/auth-card';
import { applyServerErrors, fieldError } from '../../../shared/utils/form-errors';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, InputTextModule, PasswordModule, ButtonModule, AuthCard],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  erreur = signal<string | null>(null);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    mot_de_passe: ['', Validators.required],
  });

  err = (name: string) => fieldError(this.form.get(name));

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.erreur.set(null);
    const { email, mot_de_passe } = this.form.getRawValue();

    this.auth.login(email, mot_de_passe).subscribe({
      next: (compte) => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
        this.router.navigateByUrl(compte.mot_de_passe_temporaire ? '/changer-mot-de-passe' : returnUrl);
      },
      error: (e: AppError) => {
        this.loading.set(false);
        if (e.code === 'VALIDATION_ERROR') applyServerErrors(this.form, e);
        else if (e.status === 401 || e.code === 'WEB_NOT_ALLOWED') this.erreur.set(e.message);
        // 403 (compte suspendu), 429, 5xx : déjà affichés en toast par l'intercepteur
      },
    });
  }
}