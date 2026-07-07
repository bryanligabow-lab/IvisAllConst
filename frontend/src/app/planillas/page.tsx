'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { apiGet } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { ROUTES } from '@/lib/constants';
import {
  planillaProgress,
  PLANILLA_STATUS_LABEL,
  PLANILLA_STATUS_CLASS,
} from '@/lib/planillaStatus';
import type { PlanillaStatus } from '@/types';

interface OverviewPlanilla {
  id: string;
  number: number;
  title: string;
  status: PlanillaStatus;
  totalCurrent: number;
}
interface OverviewProject {
  id: string;
  code: string;
  name: string;
  clientName: string | null;
  contractAmount: number;
  planillas: OverviewPlanilla[];
  summary: {
    planillado: number;
    facturado: number;
    porCobrar: number;
    ingresado: number;
    anticipos: number;
    presentadas: number;
    aprobadas: number;
    pagadas: number;
  };
}
interface Overview {
  totals: {
    projects: number;
    planillado: number;
    facturado: number;
    porCobrar: number;
    ingresado: number;
    anticipos: number;
    planillasIngreso: number;
    totalPlanillas: number;
    presentadas: number;
    aprobadas: number;
    pagadas: number;
  };
  projects: OverviewProject[];
}

export default function PlanillasOverviewPage() {
  const { data, isLoading } = useSWR<Overview>('/ingresos/overview', apiGet);
  const [query, setQuery] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);

  const q = query.trim().toLowerCase();
  const projects = useMemo(() => {
    let list = data?.projects ?? [];
    if (!showEmpty) list = list.filter((p) => p.planillas.length > 0);
    if (q)
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.clientName ?? '').toLowerCase().includes(q) ||
          (p.code ?? '').toLowerCase().includes(q),
      );
    return list;
  }, [data, showEmpty, q]);

  const emptyCount = (data?.projects ?? []).filter((p) => p.planillas.length === 0).length;
  const t = data?.totals;

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Planillas</h1>
        <p className="text-xs text-ink-secondary">
          Estado de cobro de todas las obras: cuánto se ha planillado, facturado, cobrado y qué
          falta — con el avance de cada planilla.
        </p>
      </div>

      {/* KPIs globales */}
      {t && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Total planillado" value={formatCurrency(t.planillado, true)} />
            <Kpi label="Facturado" value={formatCurrency(t.facturado, true)} tone="success" />
            <Kpi
              label="Por cobrar"
              value={formatCurrency(t.porCobrar, true)}
              tone={t.porCobrar > 0 ? 'warn' : 'default'}
            />
            <Kpi label="Ingresado" value={formatCurrency(t.ingresado, true)} tone="success" />
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2 text-xs sm:grid-cols-5">
            <Stat label="Planillas" value={String(t.totalPlanillas)} />
            <Stat label="Presentadas" value={String(t.presentadas)} />
            <Stat label="Aprobadas" value={String(t.aprobadas)} />
            <Stat label="Pagadas" value={String(t.pagadas)} />
            <Stat label="Anticipos" value={formatCurrency(t.anticipos, true)} />
          </div>
        </>
      )}

      {/* Buscador + toggle */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input w-full sm:max-w-xs"
          placeholder="🔍 Buscar proyecto…"
        />
        {emptyCount > 0 && (
          <label className="flex items-center gap-2 text-xs text-ink-secondary">
            <input
              type="checkbox"
              checked={showEmpty}
              onChange={(e) => setShowEmpty(e.target.checked)}
            />
            Ver {emptyCount} proyecto{emptyCount === 1 ? '' : 's'} sin planillas
          </label>
        )}
      </div>

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}
      {data && projects.length === 0 && (
        <div className="card text-sm text-ink-secondary">
          {q ? `No hay proyectos que coincidan con “${query}”.` : 'No hay planillas registradas aún.'}
        </div>
      )}

      {/* Por proyecto */}
      <div className="space-y-3">
        {projects.map((p) => (
          <div key={p.id} className="card">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={ROUTES.PROJECT_PLANILLAS(p.id)}
                  className="font-semibold text-brand hover:underline"
                >
                  {p.name}
                </Link>
                <div className="text-xs text-ink-secondary">
                  {p.clientName ?? '—'} · Contrato {formatCurrency(p.contractAmount, true)}
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="text-ink-secondary">
                  Por cobrar:{' '}
                  <span className="font-semibold text-warning">
                    {formatCurrency(p.summary.porCobrar, true)}
                  </span>
                </div>
                <div className="text-ink-secondary">
                  Ingresado:{' '}
                  <span className="font-semibold text-success">
                    {formatCurrency(p.summary.ingresado, true)}
                  </span>
                </div>
              </div>
            </div>

            {p.planillas.length === 0 ? (
              <div className="text-xs text-ink-tertiary">— Sin planillas aún —</div>
            ) : (
              <div className="space-y-2">
                {p.planillas.map((pl) => {
                  const prog = planillaProgress(pl.status);
                  const barColor =
                    prog.tone === 'success'
                      ? 'bg-success'
                      : prog.tone === 'danger'
                        ? 'bg-danger'
                        : 'bg-brand';
                  return (
                    <div key={pl.id} className="rounded-md bg-surface-muted/40 p-2">
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-ink-primary">
                          Planilla #{pl.number}
                          <span className="ml-2 text-ink-secondary">
                            {formatCurrency(pl.totalCurrent, true)}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className={PLANILLA_STATUS_CLASS[pl.status]}>
                            {PLANILLA_STATUS_LABEL[pl.status]}
                          </span>
                          <span className="font-semibold text-ink-primary">{prog.pct}%</span>
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className={`h-full rounded-full ${barColor} transition-all`}
                          style={{ width: `${prog.pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warn';
}) {
  const color =
    tone === 'success' ? 'text-success' : tone === 'warn' ? 'text-warning' : 'text-ink-primary';
  return (
    <div className="metric-card">
      <div className="text-xs text-ink-secondary">{label}</div>
      <div className={`mt-1 text-lg font-semibold tracking-tight ${color}`}>{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-muted/50 px-2 py-1.5 text-center">
      <div className="text-[10px] text-ink-tertiary">{label}</div>
      <div className="text-sm font-semibold text-ink-primary">{value}</div>
    </div>
  );
}
