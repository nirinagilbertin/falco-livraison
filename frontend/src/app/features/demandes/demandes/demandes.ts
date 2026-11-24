import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { debounceTime, distinctUntilChanged, merge } from 'rxjs';
import { DemandeListe } from '../../../core/models/demande.model';
import { AuthService } from '../../../core/services/auth.service';
import { DemandeService } from '../../../core/services/demande.service';
import { toPageParams } from '../../../shared/utils/pagination';
import { labelStatut, severiteStatut } from '../../../shared/utils/statut';

@Component({
  selector: 'app-demandes',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink, TableModule, TagModule, ButtonModule, InputTextModule, SelectModule],
  templateUrl: './demandes.html',
  styleUrl: './demandes.css',
})
export class Demandes {
  private svc = inject(DemandeService);
  private table = viewChild.required(Table);

  estPersonnel = inject(AuthService).role() !== 'expediteur';
  labelStatut = labelStatut;
  severite = severiteStatut;

  items = signal<DemandeListe[]>([]);
  total = signal(0);
  loading = signal(false);

  recherche = new FormControl('', { nonNullable: true });
  filtreStatut = new FormControl<string | null>(null);

  statuts = ['en_attente', 'en_cours', 'verifiee', 'validee', 'annulee'].map((s) => ({ label: labelStatut(s), value: s }));

  private requete = { page: 1, limit: 20 };

  constructor() {
    merge(this.recherche.valueChanges.pipe(debounceTime(400), distinctUntilChanged()), this.filtreStatut.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.table().reset());
  }

  charger(e: TableLazyLoadEvent) {
    this.requete = toPageParams(e);
    this.recharger();
  }

  recharger() {
    this.loading.set(true);
    const filtres = this.estPersonnel ? { statut: this.filtreStatut.value, q: this.recherche.value.trim() } : {};
    this.svc.list({ ...this.requete, ...filtres }).subscribe({
      next: (p) => {
        this.items.set(p.items);
        this.total.set(p.meta.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}