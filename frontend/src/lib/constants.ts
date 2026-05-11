export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'iac.access',
} as const;

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  PROJECT: (id: string) => `/projects/${id}`,
  PROJECT_BUDGET: (id: string) => `/projects/${id}/presupuesto`,
  PROJECT_EXPENSES: (id: string) => `/projects/${id}/gastos`,
  PROJECT_PLANILLAS: (id: string) => `/projects/${id}/planillas`,
} as const;

export const RUBRO_STATUS_LABEL = {
  ok: 'Disponible',
  warn: 'Bajo',
  danger: 'Excedido',
  exhausted: 'Agotado',
} as const;
