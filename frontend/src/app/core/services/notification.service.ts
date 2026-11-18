import { inject, Injectable, signal } from '@angular/core';
import { of, tap } from 'rxjs';
import { AppNotification } from '../models/notification.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private api = inject(ApiService);

  readonly items = signal<AppNotification[]>([]);
  readonly nonLues = signal(0);

  charger() {
    return this.api.list<AppNotification>('/notifications', { limit: 20 }).pipe(
      tap((p) => {
        this.items.set(p.items);
        this.nonLues.set(p.meta.non_lues ?? 0);
      }),
    );
  }

  lire(n: AppNotification) {
    if (n.statut === 'lue') return of(null);
    return this.api.post(`/notifications/${n.id_notification}/lire`).pipe(
      tap(() => {
        this.items.update((l) => l.map((x) => (x.id_notification === n.id_notification ? { ...x, statut: 'lue' as const } : x)));
        this.nonLues.update((c) => Math.max(0, c - 1));
      }),
    );
  }

  lireTout() {
    return this.api.post('/notifications/lire-tout').pipe(
      tap(() => {
        this.items.update((l) => l.map((x) => ({ ...x, statut: 'lue' as const })));
        this.nonLues.set(0);
      }),
    );
  }

  reset() {
    this.items.set([]);
    this.nonLues.set(0);
  }
}