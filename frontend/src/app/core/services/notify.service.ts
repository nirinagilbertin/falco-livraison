import { inject, Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private toast = inject(MessageService);

  success(detail: string, summary = 'Succès') {
    this.toast.add({ severity: 'success', summary, detail, life: 3000 });
  }
  error(detail: string, summary = 'Erreur') {
    this.toast.add({ severity: 'error', summary, detail, life: 5000 });
  }
  warn(detail: string, summary = 'Attention') {
    this.toast.add({ severity: 'warn', summary, detail, life: 4000 });
  }
  info(detail: string, summary = 'Information') {
    this.toast.add({ severity: 'info', summary, detail, life: 3000 });
  }
}