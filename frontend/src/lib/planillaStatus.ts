import type { PlanillaStatus } from '@/types';

// Flujo real de cobro (en orden). Lo usan la página de planillas, el modal de
// cambio de estado y el dashboard.
export const PLANILLA_STATUS_FLOW: PlanillaStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'FISCALIZACION',
  'CONTRALORIA',
  'APPROVED',
  'PAID',
];

export const PLANILLA_STATUS_LABEL: Record<PlanillaStatus, string> = {
  DRAFT: 'Elaborándose',
  SUBMITTED: 'Presentada',
  FISCALIZACION: 'En fiscalización',
  CONTRALORIA: 'En contraloría',
  APPROVED: 'Aprobada',
  PAID: 'Pagada',
  CANCELLED: 'Cancelada',
};

export const PLANILLA_STATUS_CLASS: Record<PlanillaStatus, string> = {
  DRAFT: 'badge-muted',
  SUBMITTED: 'badge-warn',
  FISCALIZACION: 'badge-warn',
  CONTRALORIA: 'badge-warn',
  APPROVED: 'badge-ok',
  PAID: 'badge-ok',
  CANCELLED: 'badge-danger',
};
