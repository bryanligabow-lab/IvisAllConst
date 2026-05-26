'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layouts/AppShell';
import { ProjectTabs } from '@/components/layouts/ProjectTabs';
import { CreateRubroModal } from '@/components/forms/CreateRubroModal';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { apiDelete, apiGet } from '@/lib/api';
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
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

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

          {/* Breakdown IVA + retenciones */}
          <div className="card mb-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <div className="text-xs uppercase text-ink-tertiary">Base sin IVA</div>
                <div className="text-base font-medium">
                  {formatCurrency(data.project.contractBase, true)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-ink-tertiary">
                  IVA {data.project.vatPercent}%
                </div>
                <div className="text-base font-medium">
                  {formatCurrency(data.project.contractVatAmount, true)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-ink-tertiary">Total con IVA</div>
                <div className="text-base font-medium text-brand">
                  {formatCurrency(data.project.contractGross, true)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-ink-tertiary">
                  {data.project.isWithholdingAgent ? 'Neto a recibir' : 'Sin retenciones'}
                </div>
                <div className="text-base font-medium">
                  {formatCurrency(data.project.netReceivable, true)}
                </div>
              </div>
            </div>
            {data.project.isWithholdingAgent && (
              <div className="mt-3 grid grid-cols-2 gap-4 border-t border-border pt-3 text-xs md:grid-cols-3">
                <div>
                  <span className="text-ink-tertiary">Retención IVA</span>{' '}
                  <span className="text-ink-secondary">
                    ({data.project.vatRetentionPercent}% del IVA)
                  </span>
                  <div className="font-medium text-danger">
                    − {formatCurrency(data.project.vatRetention, true)}
                  </div>
                </div>
                <div>
                  <span className="text-ink-tertiary">Retención Renta</span>{' '}
                  <span className="text-ink-secondary">
                    ({data.project.incomeRetentionPercent}% de la base)
                  </span>
                  <div className="font-medium text-danger">
                    − {formatCurrency(data.project.incomeRetention, true)}
                  </div>
                </div>
                <div>
                  <span className="text-ink-tertiary">Total retenciones</span>
                  <div className="font-medium text-danger">
                    − {formatCurrency(data.project.totalRetentions, true)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <CreateRubroModal
            open={showCreate}
            onClose={() => setShowCreate(false)}
            projectId={params.id}
            nextOrderIndex={data.rubros.length}
            projectVatPercent={data.project.vatPercent}
            onCreated={() => mutate()}
          />

          <DeleteConfirmDialog
            open={!!pendingDelete}
            onClose={() => setPendingDelete(null)}
            itemLabel={pendingDelete ? `el rubro "${pendingDelete.name}"` : ''}
            warning="Si tiene gastos asociados, no se podrá eliminar."
            onConfirm={async (code) => {
              if (!pendingDelete) return;
              await apiDelete(`/rubros/${pendingDelete.id}`, { deleteCode: code });
              await mutate();
              setPendingDelete(null);
            }}
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
                    <td>
                      {formatCurrency(r.budgetedAmount)}
                      {(r.utilityPercent ?? 0) > 0 || r.includesVat ? (
                        <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-ink-tertiary">
                          {(r.utilityPercent ?? 0) > 0 && (
                            <span className="rounded bg-warning-soft px-1.5 py-0.5 text-warning">
                              +Util {r.utilityPercent}%
                            </span>
                          )}
                          {r.includesVat && (
                            <span className="rounded bg-brand-soft px-1.5 py-0.5 text-brand">
                              +IVA
                            </span>
                          )}
                        </div>
                      ) : null}
                    </td>
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
                        onClick={() => setPendingDelete({ id: r.id, name: r.name })}
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
