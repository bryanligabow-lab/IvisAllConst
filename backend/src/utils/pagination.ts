import type { Request } from 'express';
import { PAGINATION } from '../shared/constants/pagination.constants';

export interface PaginationParams {
  page: number;
  perPage: number;
  skip: number;
  take: number;
}

export function getPagination(req: Request): PaginationParams {
  const page = Math.max(PAGINATION.DEFAULT_PAGE, Number(req.query.page) || PAGINATION.DEFAULT_PAGE);
  const requested = Number(req.query.perPage) || PAGINATION.DEFAULT_PER_PAGE;
  const perPage = Math.min(
    PAGINATION.MAX_PER_PAGE,
    Math.max(PAGINATION.MIN_PER_PAGE, requested),
  );
  return {
    page,
    perPage,
    skip: (page - 1) * perPage,
    take: perPage,
  };
}
