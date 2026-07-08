'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { NotificationRecipientsModal } from '@/components/forms/NotificationRecipientsModal';
import { apiGet } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { ROUTES } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import {
  planillaProgress,
  PLANILLA_STATUS_FLOW,
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
  facturado: number;
  porCobrar: number;
  periodStart: string;
  periodEnd: string;
}
interface OverviewProject {
  id: string;
  code: string;
  name: string;
  clientName: string | null;
  contractAmount: number;
  planillas: OverviewPlanilla[];
}
interface Overview {
  totals: {
    projects: number;
    planillado: number;
    facturado: number;
    porCobrar: number;
    ingresado: number;
    anticipos: number;
    totalPlanillas: number;
    presentadas: number;
    aprobadas: number;
    pagadas: number;
  };
  projects: OverviewProject[];
}

// Fila plana: una planilla con el contexto de su proyecto.
interface Row extends OverviewPlanilla {
  projectId: string;
  projectName: string;
  clientName: string | null;
  contractAmount: number;
}

const PER_PAGE = 10;
const ALL_STATUSES: PlanillaStatus[] = [...PLANILLA_STATUS_FLOW, 'CANCELLED'];

// Color por estado para los círculos del "Resumen de estado".
const STATE_COLOR: Record<PlanillaStatus, string> = {
  DRAFT: '#2563EB',
  SUBMITTED: '#C77800',
  FISCALIZACION: '#7C3AED',
  CONTRALORIA: '#EA580C',
  APPROVED: '#1B7A52',
  PAID: '#1B7A52',
  CANCELLED: '#7E1F1F',
};

function monthLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-EC', { month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function PlanillasOverviewPage() {
  const { data, isLoading } = useSWR<Overview>('/ingresos/overview', apiGet);
  const { can } = useAuthStore();
  const canManage = can('ingresos.write');

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PlanillaStatus>('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [showCorreos, setShowCorreos] = useState(false);

  // Aplana todas las planillas con su proyecto.
  const rows: Row[] = useMemo(() => {
    const list: Row[] = [];
    for (const p of data?.projects ?? []) {
      for (const pl of p.planillas) {
        list.push({
          ...pl,
          projectId: p.id,
          projectName: p.name,
          clientName: p.clientName,
          contractAmount: p.contractAmount,
        });
      }
    }
    // Más recientes primero.
    return list.sort((a, b) => (a.periodEnd < b.periodEnd ? 1 : -1));
  }, [data]);

  const statusCounts = useMemo(() => {
    const m = new Map<PlanillaStatus, number>();
    for (const r of rows) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return m;
  }, [rows]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (projectFilter !== 'ALL' && r.projectId !== projectFilter) return false;
      if (q) {
        const hay =
          r.projectName.toLowerCase().includes(q) ||
          (r.clientName ?? '').toLowerCase().includes(q) ||
          `planilla ${r.number}`.includes(q) ||
          String(r.number).includes(q);
        if (!hay) return false;
      }
      return true;
    });
  }, [rows, statusFilter, projectFilter, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(clampedPage * PER_PAGE, clampedPage * PER_PAGE + PER_PAGE);

  const t = data?.totals;
  const projectOptions = (data?.projects ?? []).filter((p) => p.planillas.length > 0);

  function exportCsv() {
    const head = ['Planilla', 'Periodo', 'Proyecto', 'Cliente', 'Contrato', 'Estado', 'Avance %', 'Monto planillado', 'Facturado', 'Por cobrar'];
    const lines = filtered.map((r) => [
      `Planilla ${r.number}`,
      monthLabel(r.periodEnd),
      r.projectName,
      r.clientName ?? '',
      r.contractAmount,
      PLANILLA_STATUS_LABEL[r.status],
      planillaProgress(r.status).pct,
      r.totalCurrent,
      r.facturado,
      r.porCobrar,
    ]);
    const csv = [head, ...lines]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Planillas - estado de cobro.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Planillas</h1>
          <p className="text-xs text-ink-secondary">
            Gestión y seguimiento del estado de cobro de todas las obras.
          </p>
        </div>
        <button onClick={() => setShowCorreos(true)} className="btn-secondary">
          ✉️ Correos
        </button>
      </div>

      {/* KPIs */}
      {t && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi icon="📄" tone="brand" label="Total planillado" value={formatCurrency(t.planillado, true)} hint={`de ${formatCurrency(t.planillado + t.porCobrar, true)} en proceso`} />
          <Kpi icon="🧾" tone="info" label="Facturado" value={formatCurrency(t.facturado, true)} hint={t.planillado > 0 ? `${Math.round((t.facturado / t.planillado) * 100)}% del planillado` : ''} />
          <Kpi icon="💰" tone="warn" label="Por cobrar" value={formatCurrency(t.porCobrar, true)} hint={t.planillado > 0 ? `${Math.round((t.porCobrar / t.planillado) * 100)}% del planillado` : ''} />
          <Kpi icon="🌱" tone="success" label="Ingresado (con anticipo)" value={formatCurrency(t.ingresado, true)} hint={`Anticipos ${formatCurrency(t.anticipos, true)}`} />
        </div>
      )}

      {/* Resumen de estado */}
      <div className="mb-4 card">
        <div className="mb-1 text-sm font-semibold">Resumen de estado</div>
        <div className="mb-3 text-xs text-ink-secondary">Todas las planillas del sistema</div>
        <div className="flex items-start overflow-x-auto pb-1">
          {PLANILLA_STATUS_FLOW.map((s, i) => {
            const count = statusCounts.get(s) ?? 0;
            const pct = planillaProgress(s).pct;
            const color = STATE_COLOR[s];
            const active = statusFilter === s;
            return (
              <Fragment key={s}>
                {i > 0 && <div className="mt-8 h-0.5 min-w-[10px] flex-1 bg-surface-border" />}
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter((cur) => (cur === s ? 'ALL' : s));
                    setPage(0);
                  }}
                  className={`flex w-[84px] shrink-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2 transition-colors ${
                    active ? 'bg-brand/10 ring-1 ring-brand' : 'hover:bg-surface-muted'
                  }`}
                  title="Filtrar por este estado"
                >
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] text-2xl font-bold"
                    style={{ borderColor: color, color, backgroundColor: `${color}14` }}
                  >
                    {count}
                  </span>
                  <span className="text-center text-[11px] font-medium leading-tight text-ink-primary">
                    {PLANILLA_STATUS_LABEL[s]}
                  </span>
                  <span className="text-[10px] font-semibold text-ink-tertiary">{pct}%</span>
                </button>
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          className="input w-full sm:max-w-xs"
          placeholder="🔍 Buscar planilla, proyecto o cliente…"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as 'ALL' | PlanillaStatus);
            setPage(0);
          }}
          className="input w-auto"
        >
          <option value="ALL">Todos los estados</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PLANILLA_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => {
            setProjectFilter(e.target.value);
            setPage(0);
          }}
          className="input w-auto"
        >
          <option value="ALL">Todos los proyectos</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button onClick={exportCsv} className="btn-secondary ml-auto text-xs">
          ⬇️ Exportar
        </button>
      </div>

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

      {/* Tabla */}
      {data && (
        <div className="card overflow-x-auto">
          <table className="table-default table-cards">
            <thead>
              <tr>
                <th>Planilla</th>
                <th>Proyecto</th>
                <th className="text-right">Contrato</th>
                <th>Estado</th>
                <th>Avance</th>
                <th className="text-right">Planillado</th>
                <th className="text-right">Facturado</th>
                <th className="text-right">Por cobrar</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => {
                const prog = planillaProgress(r.status);
                const bar =
                  prog.tone === 'success' ? 'bg-success' : prog.tone === 'danger' ? 'bg-danger' : 'bg-brand';
                return (
                  <tr key={r.id}>
                    <td data-label="Planilla">
                      <div className="font-medium">Planilla #{r.number}</div>
                      <div className="text-[11px] capitalize text-ink-tertiary">{monthLabel(r.periodEnd)}</div>
                    </td>
                    <td data-label="Proyecto">
                      <Link href={ROUTES.PROJECT_PLANILLAS(r.projectId)} className="font-medium text-brand hover:underline">
                        {r.projectName}
                      </Link>
                      <div className="text-[11px] text-ink-tertiary">{r.clientName ?? '—'}</div>
                    </td>
                    <td data-label="Contrato" className="text-right text-xs">{formatCurrency(r.contractAmount, true)}</td>
                    <td data-label="Estado">
                      <span className={PLANILLA_STATUS_CLASS[r.status]}>{PLANILLA_STATUS_LABEL[r.status]}</span>
                    </td>
                    <td data-label="Avance" className="min-w-[110px]">
                      <div className="mb-0.5 text-[11px] font-semibold text-ink-primary">{prog.pct}%</div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                        <div className={`h-full rounded-full ${bar}`} style={{ width: `${prog.pct}%` }} />
                      </div>
                    </td>
                    <td data-label="Planillado" className="text-right font-medium">{formatCurrency(r.totalCurrent, true)}</td>
                    <td data-label="Facturado" className="text-right text-info">{formatCurrency(r.facturado, true)}</td>
                    <td data-label="Por cobrar" className="text-right font-medium text-warning">{formatCurrency(r.porCobrar, true)}</td>
                    <td data-label="" className="cell-actions">
                      <Link href={ROUTES.PROJECT_PLANILLAS(r.projectId)} className="rounded-md px-2 py-1 text-xs hover:bg-surface-muted" title="Ver / actualizar">
                        👁️
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-sm text-ink-secondary">
                    No hay planillas que coincidan con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Paginación */}
          {filtered.length > PER_PAGE && (
            <div className="mt-3 flex items-center justify-between text-xs text-ink-secondary">
              <span>
                Mostrando {clampedPage * PER_PAGE + 1} a{' '}
                {Math.min((clampedPage + 1) * PER_PAGE, filtered.length)} de {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={clampedPage === 0}
                  className="rounded-md px-2 py-1 hover:bg-surface-muted disabled:opacity-40"
                >
                  ‹
                </button>
                <span className="px-2">
                  {clampedPage + 1} / {pageCount}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={clampedPage >= pageCount - 1}
                  className="rounded-md px-2 py-1 hover:bg-surface-muted disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <NotificationRecipientsModal
        open={showCorreos}
        onClose={() => setShowCorreos(false)}
        canManage={canManage}
      />
    </AppShell>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  hint?: string;
  tone: 'brand' | 'info' | 'warn' | 'success';
}) {
  const tile =
    tone === 'brand'
      ? 'bg-brand/15'
      : tone === 'info'
        ? 'bg-info/15'
        : tone === 'warn'
          ? 'bg-warning/15'
          : 'bg-success/15';
  return (
    <div className="metric-card flex items-start gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg ${tile}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-ink-secondary">{label}</div>
        <div className="mt-0.5 text-lg font-semibold tracking-tight">{value}</div>
        {hint && <div className="text-[10px] text-ink-tertiary">{hint}</div>}
      </div>
    </div>
  );
}
