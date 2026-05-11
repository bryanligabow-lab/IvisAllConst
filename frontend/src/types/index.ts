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
  rubro?: { code: string; name: string };
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
