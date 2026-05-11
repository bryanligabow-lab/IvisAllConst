export interface IPaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface IApiSuccess<T> {
  success: true;
  data: T;
  meta?: IPaginationMeta;
}

export interface IApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type IApiResponse<T> = IApiSuccess<T> | IApiError;
