import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { Parametre, Tarif } from '../models/configuration.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class TarifService {
  private api = inject(ApiService);

  actif() {
    return this.api.get<Tarif>('/tarifs/actif');
  }
  list(params?: Record<string, number>) {
    return this.api.list<Tarif>('/tarifs', params);
  }
  create(body: unknown) {
    return this.api.post<Tarif>('/tarifs', body);
  }
  activer(id: number) {
    return this.api.post<Tarif>(`/tarifs/${id}/activer`);
  }
}

@Injectable({ providedIn: 'root' })
export class ParametreService {
  private api = inject(ApiService);

  list() {
    return this.api.get<unknown>('/parametres').pipe(map((d) => this.normaliser(d)));
  }
  modifier(cle: string, valeur: string | number) {
    return this.api.patch(`/parametres/${cle}`, { valeur });
  }

  private normaliser(d: unknown): Parametre[] {
    if (Array.isArray(d)) return d as Parametre[];
    if (d && typeof d === 'object') {
      return Object.entries(d as Record<string, any>).map(([cle, v]) =>
        v !== null && typeof v === 'object' ? { cle, ...v } : { cle, valeur: v, description: null },
      );
    }
    return [];
  }
}