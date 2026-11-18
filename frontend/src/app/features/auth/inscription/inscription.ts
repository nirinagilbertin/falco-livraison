import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { AppError } from '../../../core/models/api.model';
import { RegisterPayload } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { NotifyService } from '../../../core/services/notify.service';
import { AuthCard } from '../../../shared/components/auth-card/auth-card';
import { applyServerErrors, fieldError } from '../../../shared/utils/form-errors';
import { sameAs } from '../../../shared/utils/validators';

@Component({
  selector: 'app-inscription',
  imports: [ReactiveFormsModule, RouterLink, InputTextModule, PasswordModule, SelectModule, ButtonModule, AuthCard],
  templateUrl: './inscription.html',
  styleUrl: './inscription.css',
})
export class Inscription {
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotifyService);

  loading = signal(false);
  erreur = signal<string | null>(null);

  types = [
    { label: 'Entreprise', value: 'entreprise' },
    { label: 'Fournisseur', value: 'fournisseur' },
    { label: 'Commerçant', value: 'commercant' },
  ];

  form = this.fb.group(
    {
      type_expediteur: ['entreprise', Validators.required],
      nom_complet: ['', Validators.required],
      secteur: ['', Validators.required],
      telephone: ['', Validators.required],
      nom_utilisateur: ['', Validators.required],
      adresse: [''],
      email: ['', [Validators.required, Validators.email]],
      mot_de_passe: ['', [Validators.required, Validators.minLength(8)]],
      confirmation: ['', Validators.required],
    },
    { validators: [sameAs('mot_de_passe', 'confirmation')] },
  );

  err = (name: string) => fieldError(this.form.get(name));

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.erreur.set(null);
    const { confirmation, adresse, ...rest } = this.form.getRawValue();
    const payload = { ...rest, ...(adresse ? { adresse } : {}) } as RegisterPayload;

    this.auth.register(payload).subscribe({
      next: () => {
        this.notify.success('Compte créé. Vous pouvez vous connecter.');
        this.router.navigateByUrl('/login');
      },
      error: (e: AppError) => {
        this.loading.set(false);
        if (e.code === 'VALIDATION_ERROR') applyServerErrors(this.form, e);
        else if (e.status === 409) this.erreur.set(e.message);
      },
    });
  }
}