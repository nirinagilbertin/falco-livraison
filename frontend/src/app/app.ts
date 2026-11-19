import { Component, inject, signal } from '@angular/core';
import { ToastModule } from 'primeng/toast';
import { RouterOutlet } from '@angular/router';
import { ApiService } from './core/services/api.service';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

@Component({
  selector: 'app-root',
  imports: [ToastModule, ConfirmDialogModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');

  private api = inject(ApiService);
  constructor() {
    this.api.get('/health').subscribe(console.log);
  }
}
