'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { CreateProviderModal } from '@/components/forms/CreateProviderModal';
import { apiDelete, apiGet } from '@/lib/api';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { formatCurrency } from '@/lib/format';
import type { Provider } from '@/types';

export default function ProvidersPage() {
  const { data: providers, isLoading, mutate } = useSWR<Provider[]>('/providers', apiGet);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Provider | null>(null);

  const totalDebt = providers?.reduce((s, p) => s + Number(p.totalDebt ?? 0), 0) ?? 0;
  const totalSpent = providers?.reduce((s, p) => s + Number(p.totalSpent ?? 0), 0) ?? 0;
  const withDebt = providers?.filter((p) => Number(p.totalDebt ?? 0) > 0).length ?? 0;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">Proveedores</h1>
          <p className="text-xs text-ink-secondary">
            Gestión consolidada de proveedores, deudas y pagos en todos los proyectos.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + Nuevo proveedor
        </button>
      </div>

      {providers && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Proveedores" value={String(providers.length)} />
          <Metric label="Con deuda" value={String(withDebt)} tone={withDebt > 0 ? 'danger' : 'default'} />
          <Metric label="Deuda total" value={formatCurrency(totalDebt)} tone="danger" />
          <Metric label="Total pagado histórico" value={formatCurrency(totalSpent)} tone="success" />
        </div>
      )}

      <CreateProviderModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={() => mutate()}
      />
      <CreateProviderModal
        open={!!editing}
        onClose={() => setEditing(null)}
        initial={editing}
        onSaved={() => mutate()}
      />

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        itemLabel={pendingDelete ? `al proveedor "${pendingDelete.name}"` : ''}
        warning="Sus gastos y órdenes existentes se mantendrán sin proveedor asociado."
        onConfirm={async (code) => {
          if (!pendingDelete) return;
          await apiDelete(`/providers/${pendingDelete.id}`, { deleteCode: code });
          await mutate();
          setPendingDelete(null);
        }}
      />

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

      {providers && providers.length === 0 && (
        <div className="card text-sm text-ink-secondary">
          Aún no hay proveedores. Pulsa <strong>+ Nuevo proveedor</strong> para agregar el primero.
        </div>
      )}

      {providers && providers.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="table-default table-cards">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>RUC</th>
                <th>Servicio</th>
                <th className="text-right">Deuda total</th>
                <th className="text-right">Total gastado</th>
                <th>Proyectos con deuda</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id}>
                  <td data-label="Proveedor">
                    <Link
                      href={`/proveedores/${p.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td data-label="RUC" className="text-xs">{p.ruc || '—'}</td>
                  <td data-label="Servicio" className="text-xs">{p.service || '—'}</td>
                  <td data-label="Deuda total" className={`text-right ${Number(p.totalDebt) > 0 ? 'text-danger font-medium' : 'text-ink-secondary'}`}>
                    {formatCurrency(Number(p.totalDebt ?? 0))}
                  </td>
                  <td data-label="Total gastado" className="text-right">{formatCurrency(Number(p.totalSpent ?? 0))}</td>
                  <td data-label="Proyectos con deuda">
                    {Number(p.projectsWithDebtCount ?? 0) > 0 ? (
                      <span className="badge-warn">{p.projectsWithDebtCount} proyecto(s)</span>
                    ) : (
                      <span className="text-ink-tertiary text-xs">—</span>
                    )}
                  </td>
                  <td data-label="" className="cell-actions">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(p)}
                        className="rounded-md px-2 py-1 text-xs hover:bg-surface-muted"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setPendingDelete(p)}
                        className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'danger';
}) {
  const colour =
    tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink-primary';
  return (
    <div className="metric-card">
      <div className="text-xs text-ink-secondary">{label}</div>
      <div className={`mt-1 text-xl font-medium ${colour}`}>{value}</div>
    </div>
  );
}
