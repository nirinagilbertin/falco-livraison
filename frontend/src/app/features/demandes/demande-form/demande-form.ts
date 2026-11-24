import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { AppError } from '../../../core/models/api.model';
import { DemandeService } from '../../../core/services/demande.service';
import { NotifyService } from '../../../core/services/notify.service';
import { AddressPicker } from '../../../shared/components/address-picker/address-picker';
import { applyServerErrors, clearServerErrors, fieldError, messagesServeur } from '../../../shared/utils/form-errors';
import { compact } from '../../../shared/utils/payload';

@Component({
  selector: 'app-demande-form',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, InputNumberModule, AddressPicker],
  templateUrl: './demande-form.html',
  styleUrl: './demande-form.css',
})
export class DemandeForm {
  private fb = inject(NonNullableFormBuilder);
  private svc = inject(DemandeService);
  private notify = inject(NotifyService);
  private router = inject(Router);

  saving = signal(false);

  form = this.fb.group({
    adresse_recuperation: ['', Validators.required],
    latitude_recuperation: this.fb.control<number | null>(null, Validators.required),
    longitude_recuperation: this.fb.control<number | null>(null, Validators.required),
    adresse_livraison: ['', Validators.required],
    latitude_livraison: this.fb.control<number | null>(null, Validators.required),
    longitude_livraison: this.fb.control<number | null>(null, Validators.required),
    colis: this.fb.array([this.nouveauColis()]),
    destinataires: this.fb.array([this.nouveauDestinataire()]),
  });

  get colis() {
    return this.form.controls.colis;
  }
  get destinataires() {
    return this.form.controls.destinataires;
  }

  private nouveauColis() {
    return this.fb.group({
      libelle: ['', Validators.required],
      description: [''],
      poids_estime: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
      longueur: this.fb.control<number | null>(null),
      largeur: this.fb.control<number | null>(null),
      hauteur: this.fb.control<number | null>(null),
      instructions: [''],
    });
  }

  private nouveauDestinataire() {
    return this.fb.group({
      nom: ['', Validators.required],
      prenom: [''],
      telephone: ['', Validators.required],
    });
  }

  ajouterColis() {
    if (this.colis.length < 20) this.colis.push(this.nouveauColis());
  }
  retirerColis(i: number) {
    if (this.colis.length > 1) this.colis.removeAt(i);
  }
  ajouterDestinataire() {
    if (this.destinataires.length < 5) this.destinataires.push(this.nouveauDestinataire());
  }
  retirerDestinataire(i: number) {
    if (this.destinataires.length > 1) this.destinataires.removeAt(i);
  }

  errColis = (i: number, nom: string) => fieldError(this.colis.at(i).get(nom));
  errDest = (i: number, nom: string) => fieldError(this.destinataires.at(i).get(nom));

  envoyer() {
    clearServerErrors(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.warn('Complétez les champs obligatoires avant d\'envoyer la demande.');
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body = {
      ...v,
      colis: v.colis.map((c) => compact(c)),
      destinataires: v.destinataires.map((d) => compact(d)),
    };

    this.svc.create(body).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.notify.success(`Demande ${res.numero_suivi} enregistrée. Un livreur va être recherché.`);
        this.router.navigate(['/demandes', res.id_demande]);
      },
      error: (e: AppError) => {
        this.saving.set(false);
        if (e.code === 'VALIDATION_ERROR') {
          applyServerErrors(this.form, e);
          this.notify.error(messagesServeur(e).join(' · ') || e.message);
        } else if (e.status === 409) this.notify.error(e.message);
      },
    });
  }
}