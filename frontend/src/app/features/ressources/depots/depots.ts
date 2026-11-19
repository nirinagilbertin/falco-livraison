import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AppError } from '../../../core/models/api.model';
import { LatLng } from '../../../core/models/geo.model';
import { Depot } from '../../../core/models/ressources.model';
import { AuthService } from '../../../core/services/auth.service';
import { NotifyService } from '../../../core/services/notify.service';
import { DepotService } from '../../../core/services/ressources.service';
import { MapPicker } from '../../../shared/components/map-picker/map-picker';
import { applyServerErrors, fieldError } from '../../../shared/utils/form-errors';
import { toPageParams } from '../../../shared/utils/pagination';
import { compact } from '../../../shared/utils/payload';
import { labelStatut, severiteStatut } from '../../../shared/utils/statut';

@Component({
  selector: 'app-depots',
  imports: [ReactiveFormsModule, TableModule, TagModule, ButtonModule, DialogModule, InputTextModule, InputNumberModule, SelectModule, MapPicker],
  templateUrl: './depots.html',
  styleUrl: './depots.css',
})
export class Depots {
  private svc = inject(DepotService);
  private notify = inject(NotifyService);
  private confirm = inject(ConfirmationService);
  private fb = inject(NonNullableFormBuilder);

  canWrite = inject(AuthService).role() === 'administrateur';
  labelStatut = labelStatut;
  severite = severiteStatut;

  items = signal<Depot[]>([]);
  total = signal(0);
  loading = signal(false);
  dialogOuvert = signal(false);
  enEdition = signal<Depot | null>(null);
  saving = signal(false);
  position = signal<LatLng | null>(null);

  private requete = { page: 1, limit: 20 };

  statuts = [
    { label: 'Actif', value: 'actif' },
    { label: 'Inactif', value: 'inactif' },
  ];

  form = this.fb.group({
    nom: ['', Validators.required],
    adresse: ['', Validators.required],
    latitude: this.fb.control<number | null>(null, Validators.required),
    longitude: this.fb.control<number | null>(null, Validators.required),
    statut: ['actif'],
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      this.position.set(v.latitude != null && v.longitude != null ? { lat: v.latitude, lng: v.longitude } : null);
    });
  }

  err = (name: string) => fieldError(this.form.get(name));

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

  surCarte(p: LatLng) {
    this.form.patchValue({ latitude: p.lat, longitude: p.lng });
    this.form.markAsDirty();
  }

  ouvrirCreation() {
    this.enEdition.set(null);
    this.form.reset({ statut: 'actif' });
    this.dialogOuvert.set(true);
  }

  ouvrirEdition(d: Depot) {
    this.enEdition.set(d);
    this.form.reset({
      nom: d.nom,
      adresse: d.adresse,
      latitude: Number(d.latitude),
      longitude: Number(d.longitude),
      statut: d.statut,
    });
    this.dialogOuvert.set(true);
  }

  enregistrer() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const body = compact(this.form.getRawValue());
    const edition = this.enEdition();
    const requete$ = edition ? this.svc.update(edition.id_depot, body) : this.svc.create(body);

    requete$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOuvert.set(false);
        this.notify.success(edition ? 'Dépôt modifié.' : 'Dépôt créé.');
        this.recharger();
      },
      error: (e: AppError) => {
        this.saving.set(false);
        if (e.code === 'VALIDATION_ERROR') applyServerErrors(this.form, e);
        else if (e.status === 409) this.notify.error(e.message);
      },
    });
  }

  supprimer(d: Depot) {
    this.confirm.confirm({
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      message: `Supprimer le dépôt « ${d.nom} » ? S'il a un historique, il sera désactivé.`,
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () =>
        this.svc.remove(d.id_depot).subscribe({
          next: () => {
            this.notify.success('Opération effectuée.');
            this.recharger();
          },
          error: (e: AppError) => {
            if (e.status === 409) this.notify.error(e.message);
          },
        }),
    });
  }
}