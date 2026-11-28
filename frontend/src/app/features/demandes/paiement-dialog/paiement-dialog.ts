import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { AppError } from '../../../core/models/api.model';
import { PaiementResultat } from '../../../core/models/paiement.model';
import { PaiementService } from '../../../core/services/paiement.service';
import { applyServerErrors, clearServerErrors, fieldError, messagesServeur } from '../../../shared/utils/form-errors';
import { nbChiffres } from '../../../shared/utils/validators';

type Mode = 'carte' | 'mobile_money';

@Component({
  selector: 'app-paiement-dialog',
  imports: [DecimalPipe, ReactiveFormsModule, DialogModule, ButtonModule, InputTextModule, SelectModule, SelectButtonModule],
  templateUrl: './paiement-dialog.html',
  styleUrl: './paiement-dialog.css',
})
export class PaiementDialog {
  private svc = inject(PaiementService);
  private fb = inject(NonNullableFormBuilder);

  visible = model(false);
  idDemande = input.required<number>();
  montant = input.required<number | string>();

  paye = output<PaiementResultat>();
  echec = output<void>();

  saving = signal(false);
  erreur = signal<string | null>(null);

  modes = [
    { label: 'Carte bancaire', value: 'carte' },
    { label: 'Mobile money', value: 'mobile_money' },
  ];
  operateurs = [
    { label: 'MVola', value: 'mvola' },
    { label: 'Orange Money', value: 'orange_money' },
  ];

  form = this.fb.group({
    mode_paiement: this.fb.control<Mode>('carte'),
    numero_carte: [''],
    titulaire: [''],
    expiration: [''],
    cryptogramme: [''],
    operateur: ['mvola'],
    numero: [''],
  });

  constructor() {
    this.appliquerValidateurs('carte');
    this.form.controls.mode_paiement.valueChanges.pipe(takeUntilDestroyed()).subscribe((m) => {
      this.erreur.set(null);
      this.appliquerValidateurs(m);
    });
    effect(() => {
      if (this.visible()) this.reinitialiser();
    });
  }

  err = (name: string) => fieldError(this.form.get(name));

  private appliquerValidateurs(mode: Mode) {
    const c = this.form.controls;
    const carte = mode === 'carte';
    c.numero_carte.setValidators(carte ? [Validators.required, nbChiffres(13, 19)] : []);
    c.titulaire.setValidators(carte ? [Validators.required] : []);
    c.expiration.setValidators(carte ? [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{4}$/)] : []);
    c.cryptogramme.setValidators(carte ? [Validators.required, Validators.pattern(/^\d{3,4}$/)] : []);
    c.operateur.setValidators(carte ? [] : [Validators.required]);
    c.numero.setValidators(carte ? [] : [Validators.required, nbChiffres(10, 10)]);
    Object.values(c).forEach((ctrl) => ctrl.updateValueAndValidity({ emitEvent: false }));
  }

  formaterCarte() {
    const c = this.form.controls.numero_carte;
    const chiffres = c.value.replace(/\D/g, '').slice(0, 19);
    c.setValue(chiffres.replace(/(.{4})/g, '$1 ').trim());
  }

  formaterExpiration() {
    const c = this.form.controls.expiration;
    const chiffres = c.value.replace(/\D/g, '').slice(0, 6);
    c.setValue(chiffres.length > 2 ? `${chiffres.slice(0, 2)}/${chiffres.slice(2)}` : chiffres);
  }

  /** Vide le formulaire : aucune donnée de carte ne reste en mémoire. */
  reinitialiser() {
    this.form.reset({ mode_paiement: 'carte', operateur: 'mvola' });
    this.erreur.set(null);
    this.appliquerValidateurs('carte');
  }

  envoyer() {
    this.erreur.set(null);
    clearServerErrors(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body =
      v.mode_paiement === 'carte'
        ? {
            mode_paiement: 'carte',
            numero_carte: v.numero_carte,
            titulaire: v.titulaire.trim(),
            expiration: v.expiration,
            cryptogramme: v.cryptogramme,
          }
        : { mode_paiement: 'mobile_money', operateur: v.operateur, numero: v.numero.replace(/\s/g, '') };

    this.svc.payer(this.idDemande(), body).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.visible.set(false);
        this.reinitialiser();
        this.paye.emit(res);
      },
      error: (e: AppError) => {
        this.saving.set(false);
        if (e.code === 'VALIDATION_ERROR') {
          applyServerErrors(this.form, e);
          this.erreur.set(messagesServeur(e).join(' · ') || e.message);
        } else if ([400, 402, 409].includes(e.status)) {
          this.erreur.set(e.message);
          this.form.controls.cryptogramme.reset('');
          this.echec.emit();
        }
      },
    });
  }
}