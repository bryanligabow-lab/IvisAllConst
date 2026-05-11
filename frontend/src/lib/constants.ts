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
  PROJECT_ORDERS: (id: string) => `/projects/${id}/ordenes`,
  PROJECT_PROVIDERS: (id: string) => `/projects/${id}/proveedores`,
  PROVIDERS: '/proveedores',
  NOMINA: '/nomina',
  PROFORMAS: '/proformas',
} as const;

export const RUBRO_STATUS_LABEL = {
  ok: 'Disponible',
  warn: 'Bajo',
  danger: 'Excedido',
  exhausted: 'Agotado',
} as const;

export const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo', icon: '💵' },
  { value: 'TRANSFER', label: 'Transferencia bancaria', icon: '🏦' },
  { value: 'CHECK', label: 'Cheque', icon: '📄' },
  { value: 'CREDIT_CARD', label: 'Tarjeta de crédito', icon: '💳' },
  { value: 'DEBIT_CARD', label: 'Tarjeta de débito', icon: '💳' },
  { value: 'OTHER', label: 'Otro', icon: '•' },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CHECK: 'Cheque',
  CREDIT_CARD: 'Tarjeta de crédito',
  DEBIT_CARD: 'Tarjeta de débito',
  OTHER: 'Otro',
};
