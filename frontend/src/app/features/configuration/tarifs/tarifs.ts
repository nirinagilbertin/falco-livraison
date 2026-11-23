import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AppError } from '../../../core/models/api.model';
import { Tarif } from '../../../core/models/configuration.model';
import { AuthService } from '../../../core/services/auth.service';
import { TarifService } from '../../../core/services/configuration.service';
import { NotifyService } from '../../../core/services/notify.service';
import { applyServerErrors, fieldError } from '../../../shared/utils/form-errors';
import { toPageParams } from '../../../shared/utils/pagination';

@Component({
  selector: 'app-tarifs',
  imports: [DecimalPipe, DatePipe, FormsModule, ReactiveFormsModule, TableModule, TagModule, ButtonModule, DialogModule, InputNumberModule, CheckboxModule],
  templateUrl: './tarifs.html',
  styleUrl: './tarifs.css',
})
export class Tarifs {
  private svc = inject(TarifService);
  private notify = inject(NotifyService);
  private confirm = inject(ConfirmationService);
  private fb = inject(NonNullableFormBuilder);

  estAdmin = inject(AuthService).role() === 'administrateur';

  actif = signal<Tarif | null>(null);
  items = signal<Tarif[]>([]);
  total = signal(0);
  loading = signal(false);
  dialogOuvert = signal(false);
  saving = signal(false);

  distance = signal<number | null>(10);
  poids = signal<number | null>(5);

  simulation = computed(() => {
    const t = this.actif();
    if (!t) return null;
    const base = Number(t.frais_base);
    const km = Number(t.prix_par_km) * (this.distance() ?? 0);
    const kg = Number(t.prix_par_kg) * (this.poids() ?? 0);
    return { base, km, kg, total: base + km + kg };
  });

  private requete = { page: 1, limit: 10 };

  form = this.fb.group({
    frais_base: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    prix_par_km: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    prix_par_kg: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    activer: [true],
  });

  constructor() {
    this.chargerActif();
  }

  err = (name: string) => fieldError(this.form.get(name));

  chargerActif() {
    this.svc.actif().subscribe({
      next: (t) => this.actif.set(t),
      error: () => this.actif.set(null),
    });
  }

  charger(e: TableLazyLoadEvent) {
    this.requete = toPageParams(e);
    this.recharger();
  }

  recharger() {
    this.loading.set(true);
    this.svc.list(this.requete).subscribe({
      next: (p) => {
        this.items.set(p.items);
        this.total.set(p.meta.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  ouvrirCreation() {
    this.form.reset({ activer: true });
    this.dialogOuvert.set(true);
  }

  enregistrer() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.svc.create(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOuvert.set(false);
        this.notify.success('Tarif créé.');
        this.chargerActif();
        this.recharger();
      },
      error: (e: AppError) => {
        this.saving.set(false);
        if (e.code === 'VALIDATION_ERROR') {
          const reste = applyServerErrors(this.form, e);
          if (reste.length) this.notify.error(reste.join(' · '));
        } else if (e.status === 409) this.notify.error(e.message);
      },
    });
  }

  activer(t: Tarif) {
    this.confirm.confirm({
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      message: "Activer ce tarif ? Il s'appliquera aux nouvelles demandes ; les demandes déjà créées ne changent pas.",
      acceptLabel: 'Activer',
      rejectLabel: 'Annuler',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () =>
        this.svc.activer(t.id_tarif).subscribe({
          next: () => {
            this.notify.success('Tarif activé.');
            this.chargerActif();
            this.recharger();
          },
          error: (e: AppError) => {
            if (e.status === 409 || e.status === 400) this.notify.error(e.message);
          },
        }),
    });
  }
}