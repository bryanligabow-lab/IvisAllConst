export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type PlanillaStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PAID' | 'CANCELLED';
export type RubroStatus = 'ok' | 'warn' | 'danger' | 'exhausted';

export interface Project {
  id: string;
  code: string;
  name: string;
  contractor: string | null;
  description: string | null;
  contractAmount: string | number;
  advancePercent: string | number;
  guaranteePercent: string | number;
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
  budgetedAmount: number;
  spent: number;
  balance: number;
  percentFree: number;
  status: RubroStatus;
}

export interface ProjectSummary {
  project: {
    id: string;
    code: string;
    name: string;
    contractor: string | null;
    contractAmount: number;
    advancePercent: number;
    advanceAmount: number;
    guaranteePercent: number;
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
  totalSpent?: number;
  totalDebt?: number;
  pendingOrdersCount?: number;
  projectsWithDebtCount?: number;
}

export type PaymentOrderStatus = 'PENDING' | 'PAID' | 'CANCELLED';
export type PaymentMethodValue =
  | 'CASH'
  | 'TRANSFER'
  | 'CHECK'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'OTHER';

export interface PaymentOrder {
  id: string;
  projectId: string;
  rubroId: string;
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
  rubro?: { code: string; name: string };
  provider?: { id: string; name: string; ruc?: string | null; service?: string | null } | null;
  gastos?: Array<{ id: string; amount: number; gastoDate: string; description: string }>;
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
}

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}
