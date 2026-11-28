import { inject, Injectable } from '@angular/core';
import { PaiementResultat, RecapPaiements } from '../models/paiement.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class PaiementService {
  private api = inject(ApiService);

  recap(idDemande: number) {
    return this.api.get<RecapPaiements>(`/demandes/${idDemande}/paiements`);
  }
  payer(idDemande: number, body: unknown) {
    return this.api.post<PaiementResultat>(`/demandes/${idDemande}/paiements`, body);
  }
}