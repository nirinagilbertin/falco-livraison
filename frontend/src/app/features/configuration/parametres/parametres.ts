import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { JOURS, PARAMETRES, TypeParametre } from '../../../core/config/parametres';
import { AppError } from '../../../core/models/api.model';
import { Parametre } from '../../../core/models/configuration.model';
import { AuthService } from '../../../core/services/auth.service';
import { ParametreService } from '../../../core/services/configuration.service';
import { NotifyService } from '../../../core/services/notify.service';

@Component({
  selector: 'app-parametres',
  imports: [FormsModule, ButtonModule, InputNumberModule, InputTextModule, SelectModule],
  templateUrl: './parametres.html',
  styleUrl: './parametres.css',
})
export class Parametres {
  private svc = inject(ParametreService);
  private notify = inject(NotifyService);

  private estAdmin = inject(AuthService).role() === 'administrateur';
  jours = JOURS;

  items = signal<Parametre[]>([]);
  saisies = signal<Record<string, string | number | null>>({});
  enCours = signal<string | null>(null);

  constructor() {
    this.charger();
  }

  charger() {
    this.svc.list().subscribe((liste) => {
      this.items.set(liste);
      this.saisies.set(Object.fromEntries(liste.map((p) => [p.cle, this.convertir(p, p.valeur)])));
    });
  }

  libelle = (p: Parametre) => PARAMETRES[p.cle]?.label ?? p.cle;
  aide = (p: Parametre) => PARAMETRES[p.cle]?.aide ?? p.description ?? null;
  suffixe = (p: Parametre) => (PARAMETRES[p.cle]?.unite ? ' ' + PARAMETRES[p.cle].unite : '');

  type(p: Parametre): TypeParametre {
    return PARAMETRES[p.cle]?.type ?? (Number.isNaN(Number(p.valeur)) ? 'texte' : 'nombre');
  }

  /** L'administrateur modifie tout ; le gestionnaire seulement le jour de livraison commune. */
  editable = (p: Parametre) => this.estAdmin || p.cle === 'jour_livraison_commune';

  modifie = (p: Parametre) => String(this.saisies()[p.cle] ?? '') !== String(p.valeur);

  saisir(cle: string, valeur: string | number | null) {
    this.saisies.update((s) => ({ ...s, [cle]: valeur }));
  }

  private convertir(p: Parametre, v: string | number) {
    return this.type(p) === 'texte' ? String(v) : Number(v);
  }

  enregistrer(p: Parametre) {
    const valeur = this.saisies()[p.cle];
    if (valeur === null || valeur === '') return;
    this.enCours.set(p.cle);
    this.svc.modifier(p.cle, this.type(p) === 'texte' ? String(valeur) : Number(valeur)).subscribe({
      next: () => {
        this.enCours.set(null);
        this.notify.success('Paramètre enregistré.');
        this.charger();
      },
      error: (e: AppError) => {
        this.enCours.set(null);
        if (e.status === 400 || e.status === 409) this.notify.error(e.message);
      },
    });
  }
}