'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import {
  CreateEmployeeModal,
  type Employee,
} from '@/components/forms/CreateEmployeeModal';
import { PayrollPaymentModal } from '@/components/forms/PayrollPaymentModal';
import { AsistenciaPanel } from '@/components/forms/AsistenciaPanel';
import { apiDelete, apiGet } from '@/lib/api';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { formatCurrency, formatCalendarDate } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';

interface PayrollHistoryEntry {
  id: string;
  description: string;
  amount: number;
  gastoDate: string;
  employee: { id: string; fullName: string; position: string | null } | null;
  project: { id: string; name: string; code: string };
  rubro: { code: string; name: string };
}
interface PayrollHistory {
  payments: PayrollHistoryEntry[];
  total: number;
  employeesPaid: number;
  avgPerEmployee: number;
}

export default function NominaPage() {
  const { can } = useAuthStore();
  const canPayroll = can('payroll.read');
  const canPayrollWrite = can('payroll.write');
  const canEmployeesWrite = can('employees.write');
  const canAttendance = can('attendance.read');

  const [tab, setTab] = useState<'EMPLEADOS' | 'ASISTENCIA'>('EMPLEADOS');

  const { data, isLoading, mutate } = useSWR<Employee[]>('/employees', apiGet);
  const { data: history, mutate: mutateHistory } = useSWR<PayrollHistory>(
    canPayroll ? '/employees/payroll-history' : null,
    apiGet,
  );
  const [showCreate, setShowCreate] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Employee | null>(null);

  function refresh() {
    mutate();
    mutateHistory();
  }

  const active = data?.filter((e) => e.status === 'ACTIVE') ?? [];
  const inactive = data?.filter((e) => e.status === 'INACTIVE') ?? [];

  const totalSalary = active.reduce((s, e) => s + Number(e.monthlySalary), 0);
  const totalPaid = data?.reduce((s, e) => s + Number(e.totalPaid ?? 0), 0) ?? 0;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nómina</h1>
          <p className="text-xs text-ink-secondary">
            Gestión de empleados, cargos, salarios y pagos mensuales.
          </p>
        </div>
        <div className="flex gap-2">
          {canPayrollWrite && tab === 'EMPLEADOS' && (
            <button onClick={() => setShowPay(true)} className="btn-success">
              💵 Registrar pago
            </button>
          )}
          {canEmployeesWrite && tab === 'EMPLEADOS' && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              + Nuevo empleado
            </button>
          )}
        </div>
      </div>

      {/* Sub-navegación: Empleados / Asistencia */}
      <div className="mb-5 flex gap-0 border-b border-surface-border">
        <button
          onClick={() => setTab('EMPLEADOS')}
          className={`tab ${tab === 'EMPLEADOS' ? 'tab-active' : ''}`}
        >
          Empleados
        </button>
        {canAttendance && (
          <button
            onClick={() => setTab('ASISTENCIA')}
            className={`tab ${tab === 'ASISTENCIA' ? 'tab-active' : ''}`}
          >
            Asistencia
          </button>
        )}
      </div>

      {tab === 'ASISTENCIA' ? (
        <AsistenciaPanel />
      ) : (
        <>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Empleados activos" value={String(active.length)} icon="👥" />
        <Metric label="Inactivos" value={String(inactive.length)} icon="📦" />
        {canPayroll && (
          <>
            <Metric label="Costo mensual estimado" value={formatCurrency(totalSalary)} icon="💰" tone="brand" />
            <Metric label="Pagado histórico" value={formatCurrency(totalPaid)} icon="✅" tone="success" />
          </>
        )}
      </div>

      <CreateEmployeeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={refresh}
      />
      <CreateEmployeeModal
        open={!!editing}
        onClose={() => setEditing(null)}
        initial={editing}
        onSaved={refresh}
      />
      <PayrollPaymentModal open={showPay} onClose={() => setShowPay(false)} onCreated={refresh} />

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        itemLabel={pendingDelete ? `al empleado "${pendingDelete.fullName}"` : ''}
        warning="Los pagos ya registrados se conservan."
        onConfirm={async (code) => {
          if (!pendingDelete) return;
          await apiDelete(`/employees/${pendingDelete.id}`, { deleteCode: code });
          await mutate();
          setPendingDelete(null);
        }}
      />

      <PayrollHistorySection history={history} />

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

      {data && data.length === 0 && (
        <div className="card text-sm text-ink-secondary">
          Aún no hay empleados registrados. Pulsa <strong>+ Nuevo empleado</strong> para empezar.
        </div>
      )}

      {data && data.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="table-default">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Cédula</th>
                <th>Cargo</th>
                <th>Proyecto</th>
                {canPayroll && <th className="text-right">Salario mensual</th>}
                {canPayroll && <th className="text-right">Pagado histórico</th>}
                <th>Estado</th>
                {canEmployeesWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="font-medium">{e.fullName}</div>
                    {e.email && <div className="text-xs text-ink-secondary">{e.email}</div>}
                  </td>
                  <td className="text-xs">{e.cedula || '—'}</td>
                  <td className="text-xs">{e.position || '—'}</td>
                  <td className="text-xs">{e.project?.name || '—'}</td>
                  {canPayroll && <td className="text-right">{formatCurrency(e.monthlySalary)}</td>}
                  {canPayroll && (
                    <td className="text-right">{formatCurrency(Number(e.totalPaid ?? 0))}</td>
                  )}
                  <td>
                    <span className={e.status === 'ACTIVE' ? 'badge-ok' : 'badge-muted'}>
                      {e.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {canEmployeesWrite && (
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditing(e)}
                          className="rounded-md px-2 py-1 text-xs hover:bg-surface-muted"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => setPendingDelete(e)}
                          className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </AppShell>
  );
}

function Metric({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  icon?: string;
  tone?: 'default' | 'brand' | 'success' | 'danger';
}) {
  const c =
    tone === 'brand'
      ? 'text-brand'
      : tone === 'success'
        ? 'text-success'
        : tone === 'danger'
          ? 'text-danger'
          : 'text-ink-primary';
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between">
        <div className="text-xs text-ink-secondary">{label}</div>
        {icon && <div className="text-base opacity-70">{icon}</div>}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${c}`}>{value}</div>
    </div>
  );
}

function PayrollHistorySection({ history }: { history?: PayrollHistory }) {
  if (!history || history.payments.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Historial de pagos de nómina</h2>
        <div className="text-xs text-ink-secondary">
          Total pagado: <span className="font-semibold text-ink-primary">{formatCurrency(history.total)}</span>{' '}
          · {history.employeesPaid} {history.employeesPaid === 1 ? 'empleado' : 'empleados'} ·
          promedio {formatCurrency(history.avgPerEmployee)}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-default">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Empleado</th>
              <th>Cargo</th>
              <th>Proyecto</th>
              <th>Rubro</th>
              <th>Descripción</th>
              <th className="text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {history.payments.map((p) => (
              <tr key={p.id}>
                <td className="text-xs">{formatCalendarDate(p.gastoDate)}</td>
                <td className="font-medium">{p.employee?.fullName ?? '—'}</td>
                <td className="text-xs">{p.employee?.position ?? '—'}</td>
                <td className="text-xs">{p.project.name}</td>
                <td className="text-xs">{p.rubro.code}. {p.rubro.name}</td>
                <td className="text-xs">{p.description}</td>
                <td className="text-right font-semibold">{formatCurrency(Number(p.amount), true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
