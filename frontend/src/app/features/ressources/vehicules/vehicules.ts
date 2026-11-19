import { Component, computed, inject, signal } from '@angular/core';
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
import { Vehicule, Zone } from '../../../core/models/ressources.model';
import { NotifyService } from '../../../core/services/notify.service';
import { VehiculeService, ZoneService } from '../../../core/services/ressources.service';
import { applyServerErrors, fieldError } from '../../../shared/utils/form-errors';
import { toPageParams } from '../../../shared/utils/pagination';
import { compact } from '../../../shared/utils/payload';
import { labelStatut, severiteStatut } from '../../../shared/utils/statut';

@Component({
  selector: 'app-vehicules',
  imports: [ReactiveFormsModule, TableModule, TagModule, ButtonModule, DialogModule, InputTextModule, InputNumberModule, SelectModule],
  templateUrl: './vehicules.html',
  styleUrl: './vehicules.css',
})
export class Vehicules {
  private svc = inject(VehiculeService);
  private zoneSvc = inject(ZoneService);
  private notify = inject(NotifyService);
  private confirm = inject(ConfirmationService);
  private fb = inject(NonNullableFormBuilder);

  labelStatut = labelStatut;
  severite = severiteStatut;

  items = signal<Vehicule[]>([]);
  total = signal(0);
  loading = signal(false);
  dialogOuvert = signal(false);
  enEdition = signal<Vehicule | null>(null);
  saving = signal(false);
  zones = signal<Zone[]>([]);

  private nomsZones = computed(() => new Map(this.zones().map((z) => [z.id_zone, z.nom_zone])));
  private requete = { page: 1, limit: 20 };

  types = ['moto', 'voiture', 'camionnette', 'camion'].map((t) => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t }));
  carburants = [
    { label: 'Essence', value: 'essence' },
    { label: 'Diesel', value: 'diesel' },
    { label: 'Électrique', value: 'electrique' },
    { label: 'Hybride', value: 'hybride' },
    { label: 'Autre', value: 'autre' },
  ];
  statuts = [
    { label: 'Disponible', value: 'disponible', disabled: false },
    { label: 'En service', value: 'en_service', disabled: true },
    { label: 'En maintenance', value: 'en_maintenance', disabled: false },
    { label: 'Hors service', value: 'hors_service', disabled: false },
  ];

  form = this.fb.group({
    immatriculation: ['', Validators.required],
    marque: ['', Validators.required],
    modele: ['', Validators.required],
    type_vehicule: ['', Validators.required],
    carburant: ['', Validators.required],
    capacite_poids: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    id_zone: this.fb.control<number | null>(null, Validators.required),
    statut: ['disponible'],
  });

  constructor() {
    this.zoneSvc.list({ limit: 100 }).subscribe((p) => this.zones.set(p.items));
  }

  err = (name: string) => fieldError(this.form.get(name));
  nomZone = (id: number) => this.nomsZones().get(id) ?? `#${id}`;

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
    this.enEdition.set(null);
    this.form.reset({ statut: 'disponible' });
    this.dialogOuvert.set(true);
  }

  ouvrirEdition(v: Vehicule) {
    this.enEdition.set(v);
    this.form.reset({
      immatriculation: v.immatriculation,
      marque: v.marque,
      modele: v.modele,
      type_vehicule: v.type_vehicule,
      carburant: v.carburant,
      capacite_poids: Number(v.capacite_poids),
      id_zone: v.id_zone,
      statut: v.statut,
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
    const requete$ = edition ? this.svc.update(edition.id_vehicule, body) : this.svc.create(body);

    requete$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOuvert.set(false);
        this.notify.success(edition ? 'Véhicule modifié.' : 'Véhicule créé.');
        this.recharger();
      },
      error: (e: AppError) => {
        this.saving.set(false);
        if (e.code === 'VALIDATION_ERROR') applyServerErrors(this.form, e);
        else if (e.status === 409) this.notify.error(e.message);
      },
    });
  }

  supprimer(v: Vehicule) {
    this.confirm.confirm({
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      message: `Supprimer le véhicule « ${v.immatriculation} » ? S'il a un historique, il sera désactivé.`,
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () =>
        this.svc.remove(v.id_vehicule).subscribe({
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