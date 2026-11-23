import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AppError } from '../../core/models/api.model';
import { LivreurListe } from '../../core/models/comptes.model';
import { Vehicule, Zone } from '../../core/models/ressources.model';
import { NotifyService } from '../../core/services/notify.service';
import { VehiculeService, ZoneService } from '../../core/services/ressources.service';
import { LivreurService } from '../../core/services/utilisateurs.service';
import { MotDePasseInitial } from '../../shared/components/mot-de-passe-initial/mot-de-passe-initial';
import { applyServerErrors, fieldError } from '../../shared/utils/form-errors';
import { toPageParams } from '../../shared/utils/pagination';
import { compact } from '../../shared/utils/payload';
import { labelStatut, severiteStatut } from '../../shared/utils/statut';

@Component({
  selector: 'app-livreurs',
  imports: [ReactiveFormsModule, TableModule, TagModule, ButtonModule, DialogModule, InputTextModule, SelectModule, MultiSelectModule, MotDePasseInitial],
  templateUrl: './livreurs.html',
  styleUrl: './livreurs.css',
})
export class Livreurs {
  private svc = inject(LivreurService);
  private zoneSvc = inject(ZoneService);
  private vehiculeSvc = inject(VehiculeService);
  private notify = inject(NotifyService);
  private confirm = inject(ConfirmationService);
  private fb = inject(NonNullableFormBuilder);

  labelStatut = labelStatut;
  severite = severiteStatut;

  items = signal<LivreurListe[]>([]);
  total = signal(0);
  loading = signal(false);
  saving = signal(false);
  dialogOuvert = signal(false);
  enEdition = signal<LivreurListe | null>(null);
  mdpOuvert = signal(false);
  mdp = signal('');
  emailCree = signal('');
  zones = signal<Zone[]>([]);
  vehicules = signal<Vehicule[]>([]);

  private requete = { page: 1, limit: 20 };

  categories = ['A', 'B', 'C', 'D', 'E'];

  form = this.fb.group({
    nom: ['', Validators.required],
    prenom: ['', Validators.required],
    telephone: ['', Validators.required],
    cin: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    nom_utilisateur: ['', Validators.required],
    id_vehicule: this.fb.control<number | null>(null),
    permis: this.fb.control<string[]>([], Validators.required),
    zones: this.fb.control<number[]>([], Validators.required),
  });

  constructor() {
    this.zoneSvc.list({ limit: 100 }).subscribe((p) => this.zones.set(p.items));
    this.vehiculeSvc.list({ limit: 100 }).subscribe((p) => this.vehicules.set(p.items));
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

  ouvrirCreation() {
    this.enEdition.set(null);
    this.form.reset({ permis: [], zones: [] });
    this.form.controls.email.enable();
    this.form.controls.nom_utilisateur.enable();
    this.dialogOuvert.set(true);
  }

  ouvrirEdition(l: LivreurListe) {
    this.svc.get(l.id_livreur).subscribe((d) => {
      this.enEdition.set(l);
      this.form.reset({
        nom: d.nom,
        prenom: d.prenom,
        telephone: d.telephone,
        cin: d.cin,
        email: d.email,
        nom_utilisateur: d.nom_utilisateur,
        id_vehicule: d.id_vehicule,
        permis: d.permis,
        zones: d.zones.map((z) => z.id_zone),
      });
      // l'e-mail et l'identifiant ne se modifient pas
      this.form.controls.email.disable();
      this.form.controls.nom_utilisateur.disable();
      this.dialogOuvert.set(true);
    });
  }

  enregistrer() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const { email, nom_utilisateur, ...profil } = this.form.getRawValue();
    const edition = this.enEdition();

    const requete$ = edition
      ? this.svc.update(edition.id_livreur, { ...compact(profil), id_vehicule: profil.id_vehicule })
      : this.svc.create(compact({ ...profil, email, nom_utilisateur }));

    requete$.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.dialogOuvert.set(false);
        if (!edition && res.mot_de_passe_initial) {
          this.emailCree.set(res.email);
          this.mdp.set(res.mot_de_passe_initial);
          this.mdpOuvert.set(true);
        } else {
          this.notify.success('Livreur modifié.');
        }
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

  supprimer(l: LivreurListe) {
    this.confirm.confirm({
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      message: `Supprimer le livreur « ${l.prenom} ${l.nom} » ? S'il a un historique, il sera désactivé.`,
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () =>
        this.svc.remove(l.id_livreur).subscribe({
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