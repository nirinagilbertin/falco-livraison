import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { AppError } from '../../../core/models/api.model';
import { AuthService } from '../../../core/services/auth.service';
import { NotifyService } from '../../../core/services/notify.service';
import { AuthCard } from '../../../shared/components/auth-card/auth-card';
import { applyServerErrors, fieldError } from '../../../shared/utils/form-errors';
import { sameAs } from '../../../shared/utils/validators';

@Component({
  selector: 'app-changer-mot-de-passe',
  imports: [ReactiveFormsModule, PasswordModule, ButtonModule, AuthCard],
  templateUrl: './changer-mot-de-passe.html',
  styleUrl: './changer-mot-de-passe.css',
})
export class ChangerMotDePasse {
  private fb = inject(NonNullableFormBuilder);
  private router = inject(Router);
  private notify = inject(NotifyService);
  auth = inject(AuthService);

  loading = signal(false);
  erreur = signal<string | null>(null);

  form = this.fb.group(
    {
      ancien_mot_de_passe: ['', Validators.required],
      nouveau_mot_de_passe: ['', [Validators.required, Validators.minLength(8)]],
      confirmation: ['', Validators.required],
    },
    { validators: [sameAs('nouveau_mot_de_passe', 'confirmation')] },
  );

  err = (name: string) => fieldError(this.form.get(name));

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.erreur.set(null);
    const { ancien_mot_de_passe, nouveau_mot_de_passe } = this.form.getRawValue();

    this.auth.changePassword(ancien_mot_de_passe, nouveau_mot_de_passe).subscribe({
      next: () => {
        this.auth.loadMe().subscribe({
          next: () => {
            this.notify.success('Mot de passe modifié.');
            this.router.navigateByUrl('/');
          },
          error: () => this.loading.set(false),
        });
      },
      error: (e: AppError) => {
        this.loading.set(false);
        if (e.code === 'VALIDATION_ERROR') applyServerErrors(this.form, e);
        else if (e.status < 500 && e.status !== 0 && e.status !== 403 && e.status !== 429) this.erreur.set(e.message);
      },
    });
  }
}