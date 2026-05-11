'use client';

import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layouts/AppShell';
import { ProjectTabs } from '@/components/layouts/ProjectTabs';
import { apiGet } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { RUBRO_STATUS_LABEL } from '@/lib/constants';
import type { ProjectSummary, RubroStatus } from '@/types';

const STATUS_CLASS: Record<RubroStatus, string> = {
  ok: 'badge-ok',
  warn: 'badge-warn',
  danger: 'badge-danger',
  exhausted: 'badge-muted',
};

export default function PresupuestoPage() {
  const params = useParams<{ id: string }>();
  const { data, error, isLoading } = useSWR<ProjectSummary>(
    `/projects/${params.id}/summary`,
    apiGet,
  );

  return (
    <AppShell>
      <ProjectTabs projectId={params.id} />

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}
      {error && (
        <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          <div className="mb-4">
            <h1 className="text-lg font-medium">{data.project.name} — Presupuesto por rubros</h1>
            <p className="text-xs text-ink-secondary">
              Monto contractual: {formatCurrency(data.project.contractAmount, true)} · Anticipo{' '}
              {data.project.advancePercent}%: {formatCurrency(data.project.advanceAmount, true)}
            </p>
          </div>

          <div className="card overflow-x-auto">
            <table className="table-default">
              <thead>
                <tr>
                  <th>Rubro</th>
                  <th>Presupuestado</th>
                  <th>Gastado</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.rubros.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">
                      {r.code}. {r.name}
                    </td>
                    <td>{formatCurrency(r.budgetedAmount)}</td>
                    <td>{formatCurrency(r.spent)}</td>
                    <td className={r.balance < 0 ? 'text-danger' : ''}>{formatCurrency(r.balance)}</td>
                    <td>
                      <span className={STATUS_CLASS[r.status]}>
                        {r.status === 'ok' || r.status === 'warn'
                          ? `${r.percentFree}% libre`
                          : RUBRO_STATUS_LABEL[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-ink-primary font-medium">
                  <td>Total</td>
                  <td>{formatCurrency(data.totals.budgeted)}</td>
                  <td>{formatCurrency(data.totals.spent)}</td>
                  <td>{formatCurrency(data.totals.balance)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
