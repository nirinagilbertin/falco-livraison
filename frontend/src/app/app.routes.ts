import { Routes } from '@angular/router';
import { authGuard, guestGuard, sessionGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'inscription',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/inscription/inscription').then((m) => m.Inscription),
  },
  {
    path: 'changer-mot-de-passe',
    canActivate: [sessionGuard],
    loadComponent: () =>
      import('./features/auth/changer-mot-de-passe/changer-mot-de-passe').then((m) => m.ChangerMotDePasse),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/accueil/accueil').then((m) => m.Accueil) },
      { path: 'profil', loadComponent: () => import('./features/profil/profil').then((m) => m.Profil) },
      {
        path: 'depots',
        canActivate: [roleGuard('administrateur', 'gestionnaire')],
        loadComponent: () => import('./features/ressources/depots/depots').then((m) => m.Depots),
      },
      {
        path: 'zones',
        canActivate: [roleGuard('administrateur', 'gestionnaire')],
        loadComponent: () => import('./features/ressources/zones/zones').then((m) => m.Zones),
      },
      {
        path: 'vehicules',
        canActivate: [roleGuard('administrateur', 'gestionnaire')],
        loadComponent: () => import('./features/ressources/vehicules/vehicules').then((m) => m.Vehicules),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
