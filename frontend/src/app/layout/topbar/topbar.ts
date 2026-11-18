import { Component, computed, inject, output } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { ROLE_LABELS } from '../../core/config/menu';
import { AuthService } from '../../core/services/auth.service';
import { NotificationBell } from '../notification-bell/notification-bell';

@Component({
  selector: 'app-topbar',
  imports: [MenuModule, NotificationBell],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css',
})
export class Topbar {
  auth = inject(AuthService);

  ouvrirMenu = output<void>();

  initiale = computed(() => (this.auth.compte()?.nom_utilisateur ?? '?').charAt(0).toUpperCase());
  roleLabel = computed(() => {
    const role = this.auth.role();
    return role ? ROLE_LABELS[role] : '';
  });

  items: MenuItem[] = [
    { label: 'Mon profil', icon: 'pi pi-user', routerLink: '/profil' },
    { separator: true },
    { label: 'Se déconnecter', icon: 'pi pi-sign-out', command: () => this.auth.logout() },
  ];
}