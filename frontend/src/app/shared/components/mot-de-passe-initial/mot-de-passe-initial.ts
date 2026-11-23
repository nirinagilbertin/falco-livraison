import { Component, inject, input, model } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { NotifyService } from '../../../core/services/notify.service';

@Component({
  selector: 'app-mot-de-passe-initial',
  imports: [DialogModule, ButtonModule],
  templateUrl: './mot-de-passe-initial.html',
  styleUrl: './mot-de-passe-initial.css',
})
export class MotDePasseInitial {
  private notify = inject(NotifyService);

  visible = model(false);
  email = input('');
  motDePasse = input('');

  async copier() {
    try {
      await navigator.clipboard.writeText(this.motDePasse());
      this.notify.success('Mot de passe copié.');
    } catch {
      this.notify.warn('Copie impossible, sélectionnez le mot de passe à la main.');
    }
  }
}