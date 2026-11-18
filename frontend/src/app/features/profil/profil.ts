import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ROLE_LABELS } from '../../core/config/menu';
import { AppError } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { NotifyService } from '../../core/services/notify.service';
import { applyServerErrors, fieldError } from '../../shared/utils/form-errors';

@Component({
  selector: 'app-profil',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, InputTextModule, ButtonModule],
  templateUrl: './profil.html',
  styleUrl: './profil.css',
})
export class Profil {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private notify = inject(NotifyService);

  compte = this.auth.compte;
  roleLabel = computed(() => ROLE_LABELS[this.compte()?.role ?? 'expediteur']);
  loading = signal(false);

  estExpediteur = this.auth.role() === 'expediteur';
  afficheSecteur = this.estExpediteur && this.auth.profil()?.['type_expediteur'] !== 'client';

  form = new FormGroup<Record<string, FormControl<string>>>({});

  constructor() {
    const p = this.auth.profil() ?? {};
    const ctrl = (key: string, required = false) =>
      new FormControl(String(p[key] ?? ''), { nonNullable: true, validators: required ? [Validators.required] : [] });

    this.form.addControl('telephone', ctrl('telephone', true));
    if (this.estExpediteur) {
      this.form.addControl('nom_complet', ctrl('nom_complet', true));
      this.form.addControl('adresse', ctrl('adresse'));
      if (this.afficheSecteur) this.form.addControl('secteur', ctrl('secteur', true));
    }
  }

  err = (name: string) => fieldError(this.form.get(name));

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.api.patch('/profil', this.form.getRawValue()).subscribe({
      next: () => {
        this.auth.loadMe().subscribe();
        this.notify.success('Profil mis à jour.');
        this.loading.set(false);
      },
      error: (e: AppError) => {
        this.loading.set(false);
        if (e.code === 'VALIDATION_ERROR') applyServerErrors(this.form, e);
      },
    });
  }
}