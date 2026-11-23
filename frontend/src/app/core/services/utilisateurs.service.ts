import { inject, Injectable } from '@angular/core';
import { CompteListe, CreationCompteReponse, LivreurDetail, LivreurListe } from '../models/comptes.model';
import { ApiService } from './api.service';

type Params = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: 'root' })
export class UtilisateurService {
  private api = inject(ApiService);

  list(params?: Params) {
    return this.api.list<CompteListe>('/utilisateurs', params);
  }
  create(body: unknown) {
    return this.api.post<CreationCompteReponse>('/utilisateurs', body);
  }
  changerRole(id: number, role: string) {
    return this.api.patch(`/utilisateurs/${id}/role`, { role });
  }
  suspendre(id: number) {
    return this.api.post(`/utilisateurs/${id}/suspendre`);
  }
  reactiver(id: number) {
    return this.api.post(`/utilisateurs/${id}/reactiver`);
  }
  supprimer(id: number) {
    return this.api.delete(`/utilisateurs/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class LivreurService {
  private api = inject(ApiService);

  list(params?: Params) {
    return this.api.list<LivreurListe>('/livreurs', params);
  }
  get(id: number) {
    return this.api.get<LivreurDetail>(`/livreurs/${id}`);
  }
  create(body: unknown) {
    return this.api.post<LivreurDetail>('/livreurs', body);
  }
  update(id: number, body: unknown) {
    return this.api.patch<LivreurDetail>(`/livreurs/${id}`, body);
  }
  remove(id: number) {
    return this.api.delete(`/livreurs/${id}`);
  }
}