import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AppError } from '../../../core/models/api.model';
import { LatLng } from '../../../core/models/geo.model';
import { Depot, Zone } from '../../../core/models/ressources.model';
import { AuthService } from '../../../core/services/auth.service';
import { NotifyService } from '../../../core/services/notify.service';
import { DepotService, ZoneService } from '../../../core/services/ressources.service';
import { MapPicker } from '../../../shared/components/map-picker/map-picker';
import { applyServerErrors, fieldError } from '../../../shared/utils/form-errors';
import { depuisGeoJson, versGeoJson } from '../../../shared/utils/geo';
import { toPageParams } from '../../../shared/utils/pagination';
import { compact } from '../../../shared/utils/payload';
import { labelStatut, severiteStatut } from '../../../shared/utils/statut';

@Component({
  selector: 'app-zones',
  imports: [ReactiveFormsModule, TableModule, TagModule, ButtonModule, DialogModule, InputTextModule, SelectModule, MapPicker],
  templateUrl: './zones.html',
  styleUrl: './zones.css',
})
export class Zones {
  private svc = inject(ZoneService);
  private depotSvc = inject(DepotService);
  private notify = inject(NotifyService);
  private confirm = inject(ConfirmationService);
  private fb = inject(NonNullableFormBuilder);

  canWrite = inject(AuthService).role() === 'administrateur';
  labelStatut = labelStatut;
  severite = severiteStatut;

  items = signal<Zone[]>([]);
  total = signal(0);
  loading = signal(false);
  dialogOuvert = signal(false);
  enEdition = signal<Zone | null>(null);
  saving = signal(false);
  points = signal<LatLng[]>([]);
  depots = signal<Depot[]>([]);

  private nomsDepots = computed(() => new Map(this.depots().map((d) => [d.id_depot, d.nom])));
  private requete = { page: 1, limit: 20 };

  statuts = [
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];

  form = this.fb.group({
    nom_zone: ['', Validators.required],
    ville: ['', Validators.required],
    description: [''],
    id_depot: this.fb.control<number | null>(null, Validators.required),
    statut: ['active'],
  });

  constructor() {
    this.depotSvc.list({ limit: 100 }).subscribe((p) => this.depots.set(p.items));
  }

  err = (name: string) => fieldError(this.form.get(name));
  nomDepot = (id: number) => this.nomsDepots().get(id) ?? `#${id}`;

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

  retirerPoint() {
    this.points.update((l) => l.slice(0, -1));
  }

  ouvrirCreation() {
    this.enEdition.set(null);
    this.form.reset({ statut: 'active' });
    this.points.set([]);
    this.dialogOuvert.set(true);
  }

  ouvrirEdition(z: Zone) {
    this.enEdition.set(z);
    this.form.reset({
      nom_zone: z.nom_zone,
      ville: z.ville,
      description: z.description ?? '',
      id_depot: z.id_depot,
      statut: z.statut,
    });
    this.points.set(depuisGeoJson(z.limites_geographiques));
    this.dialogOuvert.set(true);
  }

  enregistrer() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const body = compact({ ...this.form.getRawValue(), limites_geographiques: versGeoJson(this.points()) });
    const edition = this.enEdition();
    const requete$ = edition ? this.svc.update(edition.id_zone, body) : this.svc.create(body);

    requete$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOuvert.set(false);
        this.notify.success(edition ? 'Zone modifiée.' : 'Zone créée.');
        this.recharger();
      },
      error: (e: AppError) => {
        this.saving.set(false);
        if (e.code === 'VALIDATION_ERROR') applyServerErrors(this.form, e);
        else if (e.status === 409) this.notify.error(e.message);
      },
    });
  }

  supprimer(z: Zone) {
    this.confirm.confirm({
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      message: `Supprimer la zone « ${z.nom_zone} » ? Si elle a un historique, elle sera désactivée.`,
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () =>
        this.svc.remove(z.id_zone).subscribe({
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