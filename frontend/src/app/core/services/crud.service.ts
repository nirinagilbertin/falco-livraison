import { inject } from '@angular/core';
import { ApiService } from './api.service';

type Params = Record<string, string | number | boolean | null | undefined>;

export abstract class CrudService<T> {
  protected api = inject(ApiService);

  protected constructor(private path: string) {}

  list(params?: Params) {
    return this.api.list<T>(this.path, params);
  }
  get(id: number) {
    return this.api.get<T>(`${this.path}/${id}`);
  }
  create(body: unknown) {
    return this.api.post<T>(this.path, body);
  }
  update(id: number, body: unknown) {
    return this.api.patch<T>(`${this.path}/${id}`, body);
  }
  remove(id: number) {
    return this.api.delete(`${this.path}/${id}`);
  }
}