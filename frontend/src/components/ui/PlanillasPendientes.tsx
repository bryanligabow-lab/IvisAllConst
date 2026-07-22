'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { formatCurrency, formatCalendarDate } from '@/lib/format';
import { ROUTES } from '@/lib/constants';
import {
  PLANILLA_STATUS_CLASS,
  PLANILLA_STATUS_LABEL,
  planillaProgress,
} from '@/lib/planillaStatus';
import type { PlanillaStatus } from '@/types';

// Una planilla está "pendiente" mientras exista y todavía no se haya cobrado
// (no está pagada ni cancelada). Se listan en el orden real del trámite, de la
// más atrasada (recién elaborándose) a la que ya está por cobrarse.
const PENDING_STATUSES: PlanillaStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'FISCALIZACION',
  'CONTRALORIA',
  'APPROVED',
];

interface OverviewPlanilla {
  id: string;
  number: number;
  title: string | null;
  status: PlanillaStatus;
  totalCurrent: number;
  facturado: number;
  porCobrar: number;
  periodStart: string | null;
  periodEnd: string | null;
}

interface OverviewProject {
  id: string;
  code: string;
  name: string;
  clientName: string | null;
  planillas: OverviewPlanilla[];
}

interface Overview {
  projects: OverviewProject[];
}

interface PendingRow extends OverviewPlanilla {
  projectId: string;
  projectName: string;
  projectCode: string;
  clientName: string | null;
}

/**
 * Panel del dashboard: todas las planillas que siguen pendientes de cobro,
 * agrupadas por estado. Sirve para responder de un vistazo "¿qué tengo
 * pendiente y en qué paso va?" sin entrar proyecto por proyecto.
 */
export function PlanillasPendientes() {
  const { data, isLoading, error } = useSWR<Overview>('/ingresos/overview', apiGet);
  // Estados seleccionados. Vacío = todos (así al entrar se ve todo lo pendiente).
  const [selected, setSelected] = useState<PlanillaStatus[]>([]);
  const [expanded, setExpanded] = useState(false);

  const { rows, countByStatus, totalPorCobrar } = useMemo(() => {
    const all: PendingRow[] = [];
    const counts: Partial<Record<PlanillaStatus, number>> = {};
    for (const p of data?.projects ?? []) {
      for (const pl of p.planillas) {
        if (!PENDING_STATUSES.includes(pl.status)) continue;
        counts[pl.status] = (counts[pl.status] ?? 0) + 1;
        all.push({
          ...pl,
          projectId: p.id,
          projectName: p.name,
          projectCode: p.code,
          clientName: p.clientName,
        });
      }
    }
    // Orden: primero lo más atrasado del trámite, luego por proyecto y número.
    all.sort((a, b) => {
      const d = PENDING_STATUSES.indexOf(a.status) - PENDING_STATUSES.indexOf(b.status);
      if (d !== 0) return d;
      const n = a.projectName.localeCompare(b.projectName);
      return n !== 0 ? n : a.number - b.number;
    });
    const filtered = selected.length > 0 ? all.filter((r) => selected.includes(r.status)) : all;
    return {
      rows: filtered,
      countByStatus: counts,
      totalPorCobrar: filtered.reduce((s, r) => s + r.porCobrar, 0),
    };
  }, [data, selected]);

  const toggle = (s: PlanillaStatus) =>
    setSelected((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const visible = expanded ? rows : rows.slice(0, 6);

  return (
    <div className="mt-4 rounded-lg border border-surface-border bg-surface shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">
            Planillas pendientes {rows.length > 0 && `(${rows.length})`}
          </h2>
          <p className="text-[11px] text-ink-secondary">
            Planillas que aún no se han cobrado, con el paso del trámite en que están
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalPorCobrar > 0 && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-ink-tertiary">
                Por cobrar
              </div>
              <div className="text-sm font-semibold text-warning">
                {formatCurrency(totalPorCobrar)}
              </div>
            </div>
          )}
          <Link href={ROUTES.PLANILLAS} className="btn-secondary text-xs">
            Ver todas
          </Link>
        </div>
      </div>

      {/* Filtros por estado: se tocan para ver solo esas */}
      <div className="flex flex-wrap gap-1.5 border-b border-surface-border px-3 py-2">
        {PENDING_STATUSES.map((s) => {
          const n = countByStatus[s] ?? 0;
          const on = selected.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              disabled={n === 0}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-40 ${
                on
                  ? 'border-brand bg-brand text-white'
                  : 'border-surface-border bg-surface-muted/50 text-ink-secondary hover:border-brand/60 hover:text-ink-primary'
              }`}
            >
              {PLANILLA_STATUS_LABEL[s]} <span className="font-semibold">{n}</span>
            </button>
          );
        })}
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected([])}
            className="rounded-full px-2.5 py-1 text-[11px] text-ink-tertiary underline hover:text-ink-primary"
          >
            Ver todas
          </button>
        )}
      </div>

      <div className="p-3">
        {isLoading && <div className="text-sm text-ink-secondary">Cargando planillas…</div>}
        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {(error as Error).message}
          </div>
        )}
        {!isLoading && !error && rows.length === 0 && (
          <div className="rounded-md border border-dashed border-surface-border bg-surface-muted/40 p-6 text-center text-sm text-ink-secondary">
            🎉 No hay planillas pendientes
            {selected.length > 0 ? ' en los estados seleccionados.' : '. Todo está cobrado.'}
          </div>
        )}

        {visible.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((r) => (
              <PendingCard key={r.id} row={r} />
            ))}
          </div>
        )}

        {rows.length > 6 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 w-full rounded-md border border-surface-border py-2 text-xs text-ink-secondary transition-colors hover:border-brand/60 hover:text-ink-primary"
          >
            {expanded ? 'Ver menos' : `Ver las ${rows.length - 6} restantes`}
          </button>
        )}
      </div>
    </div>
  );
}

function PendingCard({ row }: { row: PendingRow }) {
  const prog = planillaProgress(row.status);
  return (
    <Link
      href={ROUTES.PROJECT_PLANILLAS(row.projectId)}
      className="block rounded-lg border border-surface-border bg-surface p-3 transition-all hover:border-brand/60 hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink-primary">{row.projectName}</div>
          <div className="truncate text-[11px] text-ink-secondary">
            Planilla #{row.number}
            {row.title ? ` · ${row.title}` : ''}
          </div>
          {row.clientName && (
            <div className="truncate text-[10px] text-ink-tertiary">👤 {row.clientName}</div>
          )}
        </div>
        <span className={`${PLANILLA_STATUS_CLASS[row.status]} shrink-0`}>
          {PLANILLA_STATUS_LABEL[row.status]}
        </span>
      </div>

      <div className="mt-2 space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-ink-tertiary">Planillado</span>
          <span className="font-medium">{formatCurrency(row.totalCurrent)}</span>
        </div>
        {row.porCobrar > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-ink-tertiary">Por cobrar</span>
            <span className="font-medium text-warning">{formatCurrency(row.porCobrar)}</span>
          </div>
        )}
      </div>

      {/* Barra: en qué paso del trámite va el cobro */}
      <div className="mt-2">
        <div className="mb-0.5 flex justify-between text-[10px] text-ink-secondary">
          <span>Avance del trámite</span>
          <span className="font-semibold text-ink-primary">{prog.pct}%</span>
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full bg-gradient-to-r from-brand to-brand-accent transition-all"
            style={{ width: `${prog.pct}%` }}
          />
        </div>
      </div>

      {(row.periodStart || row.periodEnd) && (
        <div className="mt-1 text-[10px] text-ink-tertiary">
          📅 {formatCalendarDate(row.periodStart)} — {formatCalendarDate(row.periodEnd)}
        </div>
      )}
    </Link>
  );
}
