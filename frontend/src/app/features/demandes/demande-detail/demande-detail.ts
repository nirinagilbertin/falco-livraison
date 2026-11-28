import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { AppError } from '../../../core/models/api.model';
import { ColisFiche, DemandeFiche } from '../../../core/models/demande.model';
import { AuthService } from '../../../core/services/auth.service';
import { DemandeService } from '../../../core/services/demande.service';
import { NotifyService } from '../../../core/services/notify.service';
import { labelStatut, severiteStatut } from '../../../shared/utils/statut';
import { PaiementsDemande } from '../paiements-demande/paiements-demande';

@Component({
  selector: 'app-demande-detail',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink, TableModule, TagModule, ButtonModule, DialogModule, TextareaModule, PaiementsDemande],
  templateUrl: './demande-detail.html',
  styleUrl: './demande-detail.css',
})
export class DemandeDetail {
  private route = inject(ActivatedRoute);
  private svc = inject(DemandeService);
  private notify = inject(NotifyService);
  private auth = inject(AuthService);

  labelStatut = labelStatut;
  severite = severiteStatut;

  demande = signal<DemandeFiche | null>(null);
  erreur = signal<string | null>(null);
  saving = signal(false);
  annulerOuvert = signal(false);
  motif = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(255)] });

  estExpediteur = computed(() => this.auth.role() === 'expediteur');
  peutAnnuler = computed(() => {
    const d = this.demande();
    return this.estExpediteur() && !!d && ['en_attente', 'en_cours', 'verifiee'].includes(d.statut);
  });
  nomZone = computed(() => {
    const z = this.demande()?.zone_recuperation;
    return (typeof z === 'string' ? z : z?.nom_zone) ?? '—';
  });

  paiementsVisibles = computed(() => {
    const d = this.demande();
    const role = this.auth.role();
    return !!d && (role === 'expediteur' || role === 'administrateur') && !['en_attente', 'en_cours'].includes(d.statut);
  });

  recharger() {
    const d = this.demande();
    if (d) this.svc.get(d.id_demande).subscribe((x) => this.demande.set(x));
  }

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.get(id).subscribe({
      next: (d) => this.demande.set(d),
      error: (e: AppError) =>
        this.erreur.set(e.status === 404 || e.status === 403 ? 'Demande introuvable.' : 'Impossible de charger la demande.'),
    });
  }

  dimensions(c: ColisFiche) {
    return c.longueur && c.largeur && c.hauteur ? `${c.longueur} × ${c.largeur} × ${c.hauteur}` : '—';
  }

  ouvrirAnnulation() {
    this.motif.reset('');
    this.annulerOuvert.set(true);
  }

  annuler() {
    const d = this.demande();
    if (!d) return;
    this.saving.set(true);
    this.svc.annuler(d.id_demande, this.motif.value.trim() || undefined).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.annulerOuvert.set(false);
        this.demande.set(res);
        this.notify.success('Demande annulée.');
      },
      error: (e: AppError) => {
        this.saving.set(false);
        if (e.status === 409) {
          this.annulerOuvert.set(false);
          this.notify.error(e.message);
        }
      },
    });
  }
}