'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layouts/AppShell';
import { ProjectTabs } from '@/components/layouts/ProjectTabs';
import { CreateGastoModal } from '@/components/forms/CreateGastoModal';
import { apiGet } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Gasto, ProjectSummary } from '@/types';

export default function GastosPage() {
  const params = useParams<{ id: string }>();
  const { data: summary, mutate: mutateSummary } = useSWR<ProjectSummary>(
    `/projects/${params.id}/summary`,
    apiGet,
  );
  const {
    data: gastos,
    isLoading,
    mutate: mutateGastos,
  } = useSWR<Gasto[]>(`/gastos?projectId=${params.id}&perPage=50`, apiGet);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <AppShell>
      <ProjectTabs projectId={params.id} />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium">
          Registro de gastos {summary ? `— ${summary.project.name}` : ''}
        </h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + Nuevo gasto
        </button>
      </div>

      <p className="mb-3 text-xs text-ink-secondary">
        El sistema descuenta automáticamente del presupuesto de cada rubro
      </p>

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

      {gastos && (
        <div className="card">
          {gastos.length === 0 ? (
            <div className="text-sm text-ink-secondary">Aún no hay gastos registrados.</div>
          ) : (
            <ul className="space-y-2">
              {gastos.map((g) => (
                <li key={g.id} className="flex items-center gap-3 border-b border-surface-border py-2 last:border-0">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      {g.description}
                      {g.rubro && (
                        <span className="text-ink-secondary"> · Rubro {g.rubro.code}</span>
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
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
