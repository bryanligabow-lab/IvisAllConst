export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'iac.access',
  REFRESH_TOKEN: 'iac.refresh',
} as const;

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  PROJECT: (id: string) => `/projects/${id}`,
  PROJECT_BUDGET: (id: string) => `/projects/${id}/presupuesto`,
  PROJECT_EXPENSES: (id: string) => `/projects/${id}/gastos`,
  PROJECT_PLANILLAS: (id: string) => `/projects/${id}/planillas`,
  PROJECT_INGRESOS: (id: string) => `/projects/${id}/ingresos`,
  PROJECT_ORDERS: (id: string) => `/projects/${id}/ordenes`,
  PROJECT_PROVIDERS: (id: string) => `/projects/${id}/proveedores`,
  PROJECT_DOCUMENTS: (id: string) => `/projects/${id}/documentos`,
  PROJECT_BITACORA: (id: string) => `/projects/${id}/bitacora`,
  PROVIDERS: '/proveedores',
  SUBCONTRATISTAS: '/subcontratistas',
  NOMINA: '/nomina',
  PROFORMAS: '/proformas',
  PRODUCTOS: '/productos',
  CLIENTES: '/clientes',
  PROYECTOS_REPORT: '/proyectos',
  DIRECTORIO: '/directorio',
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
  { value: 'BANCO_GUAYAQUIL', label: 'Banco Guayaquil', icon: '🏦' },
  { value: 'BANCO_PICHINCHA', label: 'Banco Pichincha', icon: '🏦' },
  { value: 'CHECK', label: 'Cheque', icon: '📄' },
  { value: 'CREDIT_CARD', label: 'Tarjeta de crédito', icon: '💳' },
  { value: 'DEBIT_CARD', label: 'Tarjeta de débito', icon: '💳' },
  { value: 'OTHER', label: 'Otro', icon: '•' },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  BANCO_GUAYAQUIL: 'Banco Guayaquil',
  BANCO_PICHINCHA: 'Banco Pichincha',
  CHECK: 'Cheque',
  CREDIT_CARD: 'Tarjeta de crédito',
  DEBIT_CARD: 'Tarjeta de débito',
  OTHER: 'Otro',
};
