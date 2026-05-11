import type { Response } from 'express';

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface SuccessPayload<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ErrorPayload {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function success<T>(res: Response, data: T, statusCode = 200, meta?: PaginationMeta): Response {
  const payload: SuccessPayload<T> = { success: true, data };
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
}

export function failure(res: Response, code: string, message: string, statusCode = 400, details?: unknown): Response {
  const payload: ErrorPayload = {
    success: false,
    error: { code, message },
  };
  if (details !== undefined && process.env.NODE_ENV !== 'production') {
    payload.error.details = details;
  }
  return res.status(statusCode).json(payload);
}

export function buildPaginationMeta(total: number, page: number, perPage: number): PaginationMeta {
  return {
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}
