import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiListResponse, ApiResponse, Page } from '../models/api.model';

type Params = Record<string, string | number | boolean | null | undefined>;

function toHttpParams(params?: Params): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  get<T>(path: string, params?: Params): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(`${this.base}${path}`, { params: toHttpParams(params) })
      .pipe(map((r) => r.data));
  }

  list<T>(path: string, params?: Params): Observable<Page<T>> {
    return this.http
      .get<ApiListResponse<T>>(`${this.base}${path}`, { params: toHttpParams(params) })
      .pipe(map((r) => ({ items: r.data, meta: r.meta })));
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<ApiResponse<T>>(`${this.base}${path}`, body ?? {}).pipe(map((r) => r.data));
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http.patch<ApiResponse<T>>(`${this.base}${path}`, body ?? {}).pipe(map((r) => r.data));
  }

  delete<T = void>(path: string): Observable<T> {
    return this.http.delete<ApiResponse<T>>(`${this.base}${path}`).pipe(map((r) => r.data));
  }
}