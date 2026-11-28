import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { timer } from 'rxjs';
import { Paiement, PaiementResultat, RecapPaiements, Recu } from '../../../core/models/paiement.model';
import { NotifyService } from '../../../core/services/notify.service';
import { PaiementService } from '../../../core/services/paiement.service';
import { severiteStatut } from '../../../shared/utils/statut';
import { PaiementDialog } from '../paiement-dialog/paiement-dialog';

const LIBELLES: Record<string, string> = { valide: 'Validé', echoue: 'Échoué', annule: 'Annulé', en_cours: 'En cours' };

@Component({
  selector: 'app-paiements-demande',
  imports: [DatePipe, DecimalPipe, TableModule, TagModule, ButtonModule, DialogModule, PaiementDialog],
  templateUrl: './paiements-demande.html',
  styleUrl: './paiements-demande.css',
})
export class PaiementsDemande {
  private svc = inject(PaiementService);
  private notify = inject(NotifyService);

  idDemande = input.required<number>();
  statutDemande = input.required<string>();
  peutPayer = input(false);
  modifie = output<void>();

  severite = severiteStatut;
  libelleStatut = (s: string) => LIBELLES[s] ?? s;

  recap = signal<RecapPaiements | null>(null);
  dialogOuvert = signal(false);
  recu = signal<Recu | null>(null);
  recuOuvert = signal(false);
  private maintenant = signal(Date.now());

  tentatives = computed(() => [...(this.recap()?.tentatives ?? [])].reverse());

  afficher = computed(() => {
    const r = this.recap();
    return !!r && (r.statut === 'verifiee' || r.tentatives.length > 0);
  });

  delai = computed(() => {
    const limite = this.recap()?.paiement_avant;
    if (!limite) return null;
    const restant = Math.ceil((new Date(limite).getTime() - this.maintenant()) / 60000);
    const heure = new Date(limite).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return restant > 0
      ? { depasse: false, texte: `À payer avant ${heure} (${restant} min restantes)` }
      : { depasse: true, texte: 'Délai de paiement dépassé : la demande va être annulée.' };
  });

  peutPayerMaintenant = computed(() => this.peutPayer() && this.recap()?.statut === 'verifiee' && !this.delai()?.depasse);

  constructor() {
    timer(0, 30_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.maintenant.set(Date.now()));
    // recharge quand le statut de la demande change (paiement, annulation…)
    effect(() => {
      this.statutDemande();
      this.charger();
    });
  }

  charger() {
    this.svc.recap(this.idDemande()).subscribe({
      next: (r) => this.recap.set(r),
      error: () => {},
    });
  }

  actualiser() {
    this.charger();
    this.modifie.emit();
  }

  libelleMode(p: Paiement) {
    return p.mode_paiement === 'carte'
      ? `Carte •••• ${p.carte_derniers_chiffres ?? ''}`
      : `${p.operateur_mobile ?? 'Mobile money'} · ${p.numero_payeur ?? ''}`;
  }

  surPaiement(res: PaiementResultat) {
    this.notify.success('Paiement validé.');
    this.recu.set(res.recu);
    this.recuOuvert.set(true);
    this.actualiser();
  }

  ouvrirRecu(p: Paiement) {
    this.recu.set({
      numero_recu: p.numero_recu ?? '',
      reference_paiement: p.reference_paiement,
      date_paiement: p.date_paiement ?? p.date_creation,
      numero_suivi: this.recap()?.numero_suivi ?? '',
      montant: p.montant,
      mode_paiement: p.mode_paiement,
    });
    this.recuOuvert.set(true);
  }
}