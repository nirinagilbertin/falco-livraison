import { Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { merge } from 'rxjs';
import { LatLng } from '../../../core/models/geo.model';
import { NotifyService } from '../../../core/services/notify.service';
import { fieldError } from '../../utils/form-errors';
import { MapPicker } from '../map-picker/map-picker';

interface ResultatRecherche {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

const arrondi = (n: number) => Math.round(n * 1e6) / 1e6;

@Component({
  selector: 'app-address-picker',
  imports: [ReactiveFormsModule, FormsModule, InputTextModule, ButtonModule, MapPicker],
  templateUrl: './address-picker.html',
  styleUrl: './address-picker.css',
})
export class AddressPicker {
  private notify = inject(NotifyService);

  /** Formulaire parent contenant adresse_*, latitude_* et longitude_*. */
  form = input.required<FormGroup>();
  suffixe = input.required<'recuperation' | 'livraison'>();
  titre = input.required<string>();

  terme = signal('');
  resultats = signal<ResultatRecherche[]>([]);
  recherche = signal(false);
  aucun = signal(false);
  point = signal<LatLng | null>(null);

  constructor() {
    effect((onCleanup) => {
      const lat = this.ctrl('latitude');
      const lng = this.ctrl('longitude');
      const maj = () =>
        this.point.set(lat.value != null && lng.value != null ? { lat: Number(lat.value), lng: Number(lng.value) } : null);
      maj();
      const sub = merge(lat.valueChanges, lng.valueChanges).subscribe(maj);
      onCleanup(() => sub.unsubscribe());
    });
  }

  ctrl(nom: 'adresse' | 'latitude' | 'longitude') {
    return this.form().get(`${nom}_${this.suffixe()}`) as FormControl;
  }

  pointManquant = () => {
    const c = this.ctrl('latitude');
    return c.touched && c.invalid;
  };

  erreurAdresse = () => fieldError(this.ctrl('adresse'));

  async chercher() {
    const q = this.terme().trim();
    if (!q) return;
    this.recherche.set(true);
    this.aucun.set(false);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=mg&accept-language=fr&q=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      const data: ResultatRecherche[] = await res.json();
      this.resultats.set(data);
      this.aucun.set(data.length === 0);
    } catch {
      this.notify.error("Recherche d'adresse indisponible. Placez le point sur la carte.");
    } finally {
      this.recherche.set(false);
    }
  }

  choisir(r: ResultatRecherche) {
    this.form().patchValue({
      [`adresse_${this.suffixe()}`]: r.display_name.slice(0, 255),
      [`latitude_${this.suffixe()}`]: arrondi(Number(r.lat)),
      [`longitude_${this.suffixe()}`]: arrondi(Number(r.lon)),
    });
    this.resultats.set([]);
  }

  surCarte(p: LatLng) {
    this.form().patchValue({
      [`latitude_${this.suffixe()}`]: p.lat,
      [`longitude_${this.suffixe()}`]: p.lng,
    });
    this.ctrl('latitude').markAsTouched();
  }
}