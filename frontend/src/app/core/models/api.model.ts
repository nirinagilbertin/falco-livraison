export interface ApiResponse<T> {
  success: true;
  message?: string;
  data: T;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiListResponse<T> extends ApiResponse<T[]> {
  meta: PageMeta;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

export interface AppError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}