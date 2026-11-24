import { inject, Injectable } from '@angular/core';
import { DemandeFiche, DemandeListe } from '../models/demande.model';
import { ApiService } from './api.service';

type Params = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: 'root' })
export class DemandeService {
  private api = inject(ApiService);

  list(params?: Params) {
    return this.api.list<DemandeListe>('/demandes', params);
  }
  get(id: number) {
    return this.api.get<DemandeFiche>(`/demandes/${id}`);
  }
  create(body: unknown) {
    return this.api.post<DemandeFiche>('/demandes', body);
  }
  annuler(id: number, motif?: string) {
    return this.api.post<DemandeFiche>(`/demandes/${id}/annuler`, motif ? { motif } : {});
  }
}