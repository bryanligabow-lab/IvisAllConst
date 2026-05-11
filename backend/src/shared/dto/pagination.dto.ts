import { z } from 'zod';
import { PAGINATION } from '../constants/pagination.constants';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  perPage: z.coerce
    .number()
    .int()
    .min(PAGINATION.MIN_PER_PAGE)
    .max(PAGINATION.MAX_PER_PAGE)
    .default(PAGINATION.DEFAULT_PER_PAGE),
});

export type PaginationQueryDto = z.infer<typeof paginationQuerySchema>;
