export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type PlanillaStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'FISCALIZACION'
  | 'CONTRALORIA'
  | 'APPROVED'
  | 'PAID'
  | 'CANCELLED';
export type RubroStatus = 'ok' | 'warn' | 'danger' | 'exhausted';

export type ExecutionType = 'OWN' | 'SUBCONTRACTED';

export interface Project {
  id: string;
  code: string;
  name: string;
  contractor: string | null;
  clientId?: string | null;
  client?: { id: string; name: string; ruc?: string | null } | null;
  executionType?: ExecutionType;
  subcontractorId?: string | null;
  subcontractor?: { id: string; name: string; ruc?: string | null } | null;
  description: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  contractAmount: string | number;
  managesAdvance?: boolean;
  advancePercent: string | number;
  guaranteePercent: string | number;
  vatPercent?: string | number;
  vatIncluded?: boolean;
  isWithholdingAgent?: boolean;
  vatRetentionPercent?: string | number;
  incomeRetentionPercent?: string | number;
  creacomProfitPercent?: string | number;
  workProgressPercent?: string | number;
  startDate: string | null;
  endDate: string | null;
  status: ProjectStatus;
  createdAt: string;
}

export interface RubroSummary {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  utilityPercent?: number;
  includesVat?: boolean;
  budgetedAmount: number;
  spent: number;
  balance: number;
  percentFree: number;
  status: RubroStatus;
  subcontractorId?: string | null;
  subcontractorName?: string | null;
  subcontractAmount?: number | null;
}

export interface ProjectSummary {
  project: {
    id: string;
    code: string;
    name: string;
    contractor: string | null;
    contractAmount: number;
    managesAdvance?: boolean;
    advancePercent: number;
    advanceAmount: number;
    guaranteePercent: number;
    vatPercent: number;
    vatIncluded: boolean;
    isWithholdingAgent: boolean;
    vatRetentionPercent: number;
    incomeRetentionPercent: number;
    contractBase: number;
    contractVatAmount: number;
    contractGross: number;
    vatRetention: number;
    incomeRetention: number;
    totalRetentions: number;
    netReceivable: number;
    startDate: string | null;
    endDate: string | null;
    status: ProjectStatus;
  };
  rubros: RubroSummary[];
  totals: {
    budgeted: number;
    spent: number;
    balance: number;
    progress: number;
  };
}

export interface Gasto {
  id: string;
  projectId: string;
  rubroId: string;
  description: string;
  invoiceNumber: string | null;
  amount: string | number;
  gastoDate: string;
  providerId?: string | null;
  paymentOrderId?: string | null;
  kind?: string;
  invoiceImageMime?: string | null;
  documents?: Array<{ id: string; mimeType: string; filename: string | null }>;
  rubro?: { code: string; name: string };
  provider?: { id: string; name: string; service?: string | null } | null;
  paymentOrder?: { id: string; description: string } | null;
}

export interface Provider {
  id: string;
  name: string;
  ruc: string | null;
  phone: string | null;
  email: string | null;
  service: string | null;
  isSubcontractor?: boolean;
  totalSpent?: number;
  totalSubcontract?: number;
  totalDebt?: number;
  pendingOrdersCount?: number;
  projectsWithDebtCount?: number;
}

export interface Client {
  id: string;
  name: string;
  ruc: string | null;
  address: string | null;
  responsible: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  proformasCount?: number;
  proformasTotal?: number;
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  description: string;
  unitPrice: number;
  imageMime?: string | null;
  hasImage?: boolean;
  createdAt?: string;
}

export interface SubcontractorView {
  id: string;
  name: string;
  ruc: string | null;
  phone: string | null;
  email: string | null;
  projects: Array<{
    id: string;
    code: string;
    name: string;
    status: ProjectStatus;
    budgeted: number;
    spent: number;
    progressBudget: number;
  }>;
}

export type PaymentOrderStatus = 'PENDING' | 'PAID' | 'CANCELLED';
export type PaymentMethodValue =
  | 'CASH'
  | 'TRANSFER'
  | 'BANCO_GUAYAQUIL'
  | 'BANCO_PICHINCHA'
  | 'CHECK'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'OTHER';

export interface PaymentOrderItem {
  id: string;
  amount: number;
  rubro: { id: string; code: string; name: string };
}

export interface PaymentOrder {
  id: string;
  projectId: string;
  rubroId: string | null;
  providerId: string | null;
  description: string;
  amount: number;
  invoiceNumber: string | null;
  paymentMethod: PaymentMethodValue | null;
  scheduledDate: string;
  paidAt: string | null;
  status: PaymentOrderStatus;
  paidAmount: number;
  pendingAmount: number;
  invoiceImageMime?: string | null;
  rubro?: { code: string; name: string } | null;
  items?: PaymentOrderItem[];
  provider?: { id: string; name: string; ruc?: string | null; service?: string | null } | null;
  gastos?: Array<{ id: string; amount: number; gastoDate: string; description: string }>;
}

export interface PlanillaStatusEvent {
  id: string;
  status: PlanillaStatus;
  note: string | null;
  createdAt: string;
  creator?: { firstName: string; lastName: string };
}

export interface Planilla {
  id: string;
  projectId: string;
  number: number;
  title: string;
  status: PlanillaStatus;
  periodStart: string;
  periodEnd: string;
  totalCurrent: string | number;
  totalPrevious: string | number;
  totalAccumulated: string | number;
  advanceAmortization: string | number;
  guaranteeRetention: string | number;
  netPayable: string | number;
  // Últimos movimientos de estado (los devuelve el listado).
  statusEvents?: PlanillaStatusEvent[];
}

export type IngresoKind = 'ANTICIPO' | 'PLANILLA' | 'OTRO';

export interface Ingreso {
  id: string;
  projectId: string;
  planillaId: string | null;
  kind: IngresoKind;
  amount: string | number;
  ingresoDate: string;
  entity: string | null;
  invoiceNumber: string | null;
  reference: string | null;
  notes: string | null;
  documentMime?: string | null;
  documentName?: string | null;
  hasDocument?: boolean;
  planilla?: { id: string; number: number; title: string } | null;
  creator?: { firstName: string; lastName: string };
}

export interface IngresosSummary {
  project: {
    id: string;
    code: string;
    name: string;
    clientName: string | null;
    contractAmount: number;
    managesAdvance: boolean;
    advancePercent: number;
    advanceExpected: number;
  };
  anticipo: {
    recibido: number;
    devengado: number;
    saldoPorDevengar: number;
  };
  planillas: {
    total: number;
    presentadas: number;
    aprobadas: number;
    pagadas: number;
    totalPlanillado: number;
    facturado: number;
    porCobrar: number;
  };
  ingresos: {
    anticipos: number;
    planillas: number;
    otros: number;
    total: number;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  // Proyectos asignados (relevante para el rol operador).
  projectIds?: string[];
}
