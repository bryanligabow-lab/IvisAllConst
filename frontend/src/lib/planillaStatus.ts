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

// Progreso del cobro como barra: qué % del proceso lleva la planilla.
// Presentada ≈ 33%, En contraloría ≈ 66%, Pagada = 100%.
export function planillaProgress(status: PlanillaStatus): {
  pct: number;
  label: string;
  tone: 'brand' | 'success' | 'danger';
} {
  if (status === 'CANCELLED') return { pct: 100, label: 'Cancelada', tone: 'danger' };
  const idx = PLANILLA_STATUS_FLOW.indexOf(status);
  const pct = Math.round(((idx + 1) / PLANILLA_STATUS_FLOW.length) * 100);
  return { pct, label: PLANILLA_STATUS_LABEL[status], tone: status === 'PAID' ? 'success' : 'brand' };
}

export const PLANILLA_STATUS_CLASS: Record<PlanillaStatus, string> = {
  DRAFT: 'badge-muted',
  SUBMITTED: 'badge-warn',
  FISCALIZACION: 'badge-warn',
  CONTRALORIA: 'badge-warn',
  APPROVED: 'badge-ok',
  PAID: 'badge-ok',
  CANCELLED: 'badge-danger',
};
