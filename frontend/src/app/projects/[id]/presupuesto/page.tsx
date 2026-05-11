'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layouts/AppShell';
import { ProjectTabs } from '@/components/layouts/ProjectTabs';
import { CreateRubroModal } from '@/components/forms/CreateRubroModal';
import { apiDelete, apiGet, ApiClientError } from '@/lib/api';
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
  const { data, error, isLoading, mutate } = useSWR<ProjectSummary>(
    `/projects/${params.id}/summary`,
    apiGet,
  );
  const [showCreate, setShowCreate] = useState(false);

  async function handleDelete(rubroId: string, name: string) {
    if (
      !window.confirm(
        `¿Eliminar el rubro "${name}"?\n\nSi tiene gastos asociados, no se podrá eliminar.`,
      )
    )
      return;
    try {
      await apiDelete(`/rubros/${rubroId}`);
      mutate();
    } catch (err) {
      window.alert(err instanceof ApiClientError ? err.message : 'No se pudo eliminar el rubro');
    }
  }

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
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-medium">{data.project.name} — Presupuesto por rubros</h1>
              <p className="text-xs text-ink-secondary">
                Monto contractual: {formatCurrency(data.project.contractAmount, true)} · Anticipo{' '}
                {data.project.advancePercent}%: {formatCurrency(data.project.advanceAmount, true)}
              </p>
            </div>
            <button onClick={() => setShowCreate(true)} className="btn-primary whitespace-nowrap">
              + Añadir rubro
            </button>
          </div>

          <CreateRubroModal
            open={showCreate}
            onClose={() => setShowCreate(false)}
            projectId={params.id}
            nextOrderIndex={data.rubros.length}
            onCreated={() => mutate()}
          />

          <div className="card overflow-x-auto">
            <table className="table-default">
              <thead>
                <tr>
                  <th>Rubro</th>
                  <th>Unidad</th>
                  <th>Cantidad</th>
                  <th>P. unitario</th>
                  <th>Presupuestado</th>
                  <th>Gastado</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.rubros.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-sm text-ink-secondary">
                      Aún no hay rubros. Pulsa <strong>+ Añadir rubro</strong> para empezar a armar
                      el presupuesto.
                    </td>
                  </tr>
                )}
                {data.rubros.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">
                      {r.code}. {r.name}
                    </td>
                    <td>{r.unit ?? '—'}</td>
                    <td>{r.quantity || '—'}</td>
                    <td>{r.unitPrice ? formatCurrency(r.unitPrice) : '—'}</td>
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
                    <td>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id, r.name)}
                        className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
                        title="Eliminar rubro"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {data.rubros.length > 0 && (
                  <tr className="border-t-2 border-ink-primary font-medium">
                    <td colSpan={4}>Total</td>
                    <td>{formatCurrency(data.totals.budgeted)}</td>
                    <td>{formatCurrency(data.totals.spent)}</td>
                    <td>{formatCurrency(data.totals.balance)}</td>
                    <td />
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
