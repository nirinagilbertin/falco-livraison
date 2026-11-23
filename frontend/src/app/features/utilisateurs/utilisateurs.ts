import { DatePipe } from '@angular/common';
import { Component, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ROLE_LABELS } from '../../core/config/menu';
import { AppError } from '../../core/models/api.model';
import { Role } from '../../core/models/auth.model';
import { CompteListe } from '../../core/models/comptes.model';
import { AuthService } from '../../core/services/auth.service';
import { NotifyService } from '../../core/services/notify.service';
import { UtilisateurService } from '../../core/services/utilisateurs.service';
import { MotDePasseInitial } from '../../shared/components/mot-de-passe-initial/mot-de-passe-initial';
import { applyServerErrors, fieldError } from '../../shared/utils/form-errors';
import { toPageParams } from '../../shared/utils/pagination';
import { Severity, labelStatut, severiteStatut } from '../../shared/utils/statut';

@Component({
  selector: 'app-utilisateurs',
  imports: [ReactiveFormsModule, DatePipe, TableModule, TagModule, ButtonModule, DialogModule, InputTextModule, SelectModule, TooltipModule, MotDePasseInitial],
  templateUrl: './utilisateurs.html',
  styleUrl: './utilisateurs.css',
})
export class Utilisateurs {
  private svc = inject(UtilisateurService);
  private notify = inject(NotifyService);
  private confirm = inject(ConfirmationService);
  private fb = inject(NonNullableFormBuilder);
  private table = viewChild.required(Table);

  monId = inject(AuthService).compte()?.id_compte;
  labelStatut = labelStatut;
  severite = severiteStatut;

  items = signal<CompteListe[]>([]);
  total = signal(0);
  loading = signal(false);
  saving = signal(false);
  dialogOuvert = signal(false);
  roleDialogOuvert = signal(false);
  cible = signal<CompteListe | null>(null);
  mdpOuvert = signal(false);
  mdp = signal('');
  emailCree = signal('');

  private requete = { page: 1, limit: 20 };

  filtreRole = new FormControl<string | null>(null);
  nouveauRole = new FormControl('gestionnaire', { nonNullable: true });

  rolesFiltre = (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ label: ROLE_LABELS[r], value: r }));
  rolesCreation = [
    { label: 'Gestionnaire', value: 'gestionnaire' },
    { label: 'Superviseur', value: 'superviseur' },
  ];

  form = this.fb.group({
    role: ['gestionnaire', Validators.required],
    nom: ['', Validators.required],
    prenom: ['', Validators.required],
    telephone: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    nom_utilisateur: ['', Validators.required],
  });

  constructor() {
    this.filtreRole.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.table().reset());
  }

  err = (name: string) => fieldError(this.form.get(name));

  nomAffiche(u: CompteListe) {
    return u.nom_complet || `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() || '—';
  }

  libelleRole(u: CompteListe) {
    return u.role === 'expediteur' ? labelStatut(u.type_expediteur ?? 'expediteur') : ROLE_LABELS[u.role];
  }

  severiteRole(r: Role): Severity {
    switch (r) {
      case 'administrateur':
        return 'danger';
      case 'gestionnaire':
        return 'info';
      case 'superviseur':
        return 'warn';
      default:
        return 'secondary';
    }
  }

  charger(e: TableLazyLoadEvent) {
    this.requete = toPageParams(e);
    this.recharger();
  }

  recharger() {
    this.loading.set(true);
    this.svc.list({ ...this.requete, role: this.filtreRole.value }).subscribe({
      next: (p) => {
        this.items.set(p.items);
        this.total.set(p.meta.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  ouvrirCreation() {
    this.form.reset({ role: 'gestionnaire' });
    this.dialogOuvert.set(true);
  }

  enregistrer() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.svc.create(this.form.getRawValue()).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.dialogOuvert.set(false);
        this.emailCree.set(res.compte.email);
        this.mdp.set(res.mot_de_passe_initial);
        this.mdpOuvert.set(true);
        this.recharger();
      },
      error: (e: AppError) => this.erreurFormulaire(e),
    });
  }

  private erreurFormulaire(e: AppError) {
    this.saving.set(false);
    if (e.code === 'VALIDATION_ERROR') {
      const reste = applyServerErrors(this.form, e);
      if (reste.length) this.notify.error(reste.join(' · '));
    } else if (e.status === 409) this.notify.error(e.message);
  }

  ouvrirRole(u: CompteListe) {
    this.cible.set(u);
    this.nouveauRole.setValue(u.role === 'superviseur' ? 'superviseur' : 'gestionnaire');
    this.roleDialogOuvert.set(true);
  }

  changerRole() {
    const u = this.cible();
    if (!u) return;
    this.saving.set(true);
    this.svc.changerRole(u.id_compte, this.nouveauRole.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.roleDialogOuvert.set(false);
        this.notify.success('Rôle modifié.');
        this.recharger();
      },
      error: (e: AppError) => {
        this.saving.set(false);
        if (e.status === 409 || e.status === 400) this.notify.error(e.message);
      },
    });
  }

  suspendre(u: CompteListe) {
    this.confirm.confirm({
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      message: `Suspendre le compte de « ${this.nomAffiche(u)} » ? Il ne pourra plus se connecter.`,
      acceptLabel: 'Suspendre',
      rejectLabel: 'Annuler',
      acceptButtonProps: { severity: 'warn' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this.action(this.svc.suspendre(u.id_compte), 'Compte suspendu.'),
    });
  }

  reactiver(u: CompteListe) {
    this.action(this.svc.reactiver(u.id_compte), 'Compte réactivé.');
  }

  supprimer(u: CompteListe) {
    this.confirm.confirm({
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      message: `Supprimer le compte de « ${this.nomAffiche(u)} » ? La suppression n'est possible que sans historique, sinon suspendez-le.`,
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this.action(this.svc.supprimer(u.id_compte), 'Compte supprimé.'),
    });
  }

  private action(requete$: ReturnType<UtilisateurService['suspendre']>, message: string) {
    requete$.subscribe({
      next: () => {
        this.notify.success(message);
        this.recharger();
      },
      error: (e: AppError) => {
        if (e.status === 409 || e.status === 400) this.notify.error(e.message);
      },
    });
  }
}