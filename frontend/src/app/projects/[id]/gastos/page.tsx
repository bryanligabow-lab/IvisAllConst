'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layouts/AppShell';
import { ProjectTabs } from '@/components/layouts/ProjectTabs';
import { CreateGastoModal } from '@/components/forms/CreateGastoModal';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { apiDelete, apiGet } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import type { Gasto, ProjectSummary } from '@/types';

export default function GastosPage() {
  const params = useParams<{ id: string }>();
  const { data: summary, mutate: mutateSummary } = useSWR<ProjectSummary>(
    `/projects/${params.id}/summary`,
    apiGet,
  );
  const [filterRubroId, setFilterRubroId] = useState('');
  const gastosKey = filterRubroId
    ? `/gastos?projectId=${params.id}&rubroId=${filterRubroId}&perPage=100`
    : `/gastos?projectId=${params.id}&perPage=100`;
  const { data: gastos, isLoading, mutate: mutateGastos } = useSWR<Gasto[]>(gastosKey, apiGet);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; description: string } | null>(null);

  async function handleExport() {
    const token =
      typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) : null;
    const qs = new URLSearchParams({ projectId: params.id });
    if (filterRubroId) qs.set('rubroId', filterRubroId);
    const res = await fetch(`${API_BASE_URL}/gastos/export?${qs.toString()}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!res.ok) {
      window.alert('No se pudo generar el Excel');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gastos-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <ProjectTabs projectId={params.id} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-medium">
          Registro de gastos {summary ? `— ${summary.project.name}` : ''}
        </h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + Nuevo gasto
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-ink-secondary mb-1">Filtrar por rubro</label>
          <select
            value={filterRubroId}
            onChange={(e) => setFilterRubroId(e.target.value)}
            className="input"
            disabled={!summary}
          >
            <option value="">— Todos los rubros —</option>
            {summary?.rubros.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code}. {r.name}
              </option>
            ))}
          </select>
        </div>
        <button onClick={handleExport} disabled={!gastos || gastos.length === 0} className="btn-success disabled:opacity-50">
          📊 Exportar a Excel
        </button>
      </div>

      <p className="mb-3 text-xs text-ink-secondary">
        El sistema descuenta automáticamente del presupuesto de cada rubro
      </p>

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

      {gastos && (
        <div className="card">
          {gastos.length === 0 ? (
            <div className="text-sm text-ink-secondary">
              {filterRubroId ? 'No hay gastos en este rubro.' : 'Aún no hay gastos registrados.'}
            </div>
          ) : (
            <ul className="space-y-2">
              {gastos.map((g) => (
                <li key={g.id} className="flex items-center gap-3 border-b border-surface-border py-2 last:border-0">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      {g.description}
                      {g.rubro && (
                        <span className="text-ink-secondary">
                          {' · '}
                          {g.rubro.code}. {g.rubro.name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-secondary">
                      {formatDate(g.gastoDate)}
                      {g.invoiceNumber && ` · Factura ${g.invoiceNumber}`}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-medium text-danger">
                    -{formatCurrency(Number(g.amount), true)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingDelete({ id: g.id, description: g.description })}
                    className="shrink-0 rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
                    title="Eliminar gasto"
                  >
                    🗑️
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        itemLabel={pendingDelete ? `el gasto "${pendingDelete.description}"` : ''}
        warning="El saldo del rubro se restaurará automáticamente."
        onConfirm={async (code) => {
          if (!pendingDelete) return;
          await apiDelete(`/gastos/${pendingDelete.id}`, { deleteCode: code });
          await Promise.all([mutateGastos(), mutateSummary()]);
          setPendingDelete(null);
        }}
      />

      {summary && (
        <CreateGastoModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          projectId={params.id}
          rubros={summary.rubros}
          onCreated={() => {
            mutateGastos();
            mutateSummary();
          }}
        />
      )}

      {summary && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricCard label="Total gastado" value={formatCurrency(summary.totals.spent)} tone="danger" />
          <MetricCard label="Saldo disponible" value={formatCurrency(summary.totals.balance)} tone="success" />
          <MetricCard
            label="Rubros excedidos"
            value={String(summary.rubros.filter((r) => r.status === 'danger').length)}
            tone="danger"
          />
        </div>
      )}
    </AppShell>
  );
}

function MetricCard({
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
