import { Injectable } from '@angular/core';

const KEY = 'falco_token';

@Injectable({ providedIn: 'root' })
export class TokenService {
  get(): string | null {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }
  set(token: string): void {
    try { localStorage.setItem(KEY, token); } catch { /* ignoré */ }
  }
  clear(): void {
    try { localStorage.removeItem(KEY); } catch { /* ignoré */ }
  }
}