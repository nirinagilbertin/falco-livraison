import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PopoverModule } from 'primeng/popover';
import { catchError, EMPTY, switchMap, timer } from 'rxjs';
import { AppNotification } from '../../core/models/notification.model';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-notification-bell',
  imports: [DatePipe, PopoverModule],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.css',
})
export class NotificationBell {
  notif = inject(NotificationService);

  constructor() {
    // rafraîchit les notifications toutes les 60 secondes
    timer(0, 60_000)
      .pipe(
        switchMap(() => this.notif.charger().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  lire(n: AppNotification) {
    if (n.statut === 'non_lue') this.notif.lire(n).subscribe();
  }

  toutLire() {
    this.notif.lireTout().subscribe();
  }
}