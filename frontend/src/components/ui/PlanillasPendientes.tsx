'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { apiGet, apiPatch } from '@/lib/api';
import { formatCurrency, formatCalendarDate } from '@/lib/format';
import { ROUTES } from '@/lib/constants';
import {
  PLANILLA_STATUS_CLASS,
  PLANILLA_STATUS_LABEL,
  planillaProgress,
} from '@/lib/planillaStatus';
import { useAuthStore } from '@/stores/authStore';
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
  estimatedAmount: number | null;
  estimatedNote: string | null;
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
  const { data, isLoading, error, mutate } = useSWR<Overview>('/ingresos/overview', apiGet);
  // Solo gerencia (planillas.write) puede escribir el valor estimado.
  const canEdit = useAuthStore().can('planillas.write');
  // Estados seleccionados. Vacío = todos (así al entrar se ve todo lo pendiente).
  const [selected, setSelected] = useState<PlanillaStatus[]>([]);
  // Cliente elegido en el selector. 'ALL' = todos los clientes.
  const [client, setClient] = useState('ALL');
  const [expanded, setExpanded] = useState(false);

  const { rows, countByStatus, totalPorCobrar, totalEstimado, clients } = useMemo(() => {
    const all: PendingRow[] = [];
    const clientSet = new Set<string>();
    for (const p of data?.projects ?? []) {
      for (const pl of p.planillas) {
        if (!PENDING_STATUSES.includes(pl.status)) continue;
        if (p.clientName) clientSet.add(p.clientName);
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
    // El cliente se aplica primero: los conteos por estado son del cliente elegido.
    const byClient = client === 'ALL' ? all : all.filter((r) => r.clientName === client);
    const counts: Partial<Record<PlanillaStatus, number>> = {};
    for (const r of byClient) counts[r.status] = (counts[r.status] ?? 0) + 1;
    const filtered =
      selected.length > 0 ? byClient.filter((r) => selected.includes(r.status)) : byClient;
    return {
      rows: filtered,
      countByStatus: counts,
      totalPorCobrar: filtered.reduce((s, r) => s + r.porCobrar, 0),
      totalEstimado: filtered.reduce((s, r) => s + (r.estimatedAmount ?? 0), 0),
      clients: [...clientSet].sort((a, b) => a.localeCompare(b)),
    };
  }, [data, selected, client]);

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
          {clients.length > 1 && (
            <select
              value={client}
              onChange={(e) => {
                setClient(e.target.value);
                setSelected([]);
              }}
              className="input text-xs"
              title="Filtrar por cliente"
            >
              <option value="ALL">Todos los clientes</option>
              {clients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {totalEstimado > 0 && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-ink-tertiary">
                Estimado
              </div>
              <div className="text-sm font-semibold text-brand">
                {formatCurrency(totalEstimado)}
              </div>
            </div>
          )}
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
              <PendingCard key={r.id} row={r} canEdit={canEdit} onSaved={() => mutate()} />
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

function PendingCard({
  row,
  canEdit,
  onSaved,
}: {
  row: PendingRow;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const prog = planillaProgress(row.status);
  return (
    <div className="rounded-lg border border-surface-border bg-surface p-3 transition-all hover:border-brand/60 hover:shadow-card">
      <Link href={ROUTES.PROJECT_PLANILLAS(row.projectId)} className="block">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink-primary">
              {row.projectName}
            </div>
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

      <EstimateEditor row={row} canEdit={canEdit} onSaved={onSaved} />
    </div>
  );
}

// Valor estimado editable (conciliación): gerencia lo escribe mientras la
// planilla no sale oficialmente y lo actualiza cuando llega el valor real.
function EstimateEditor({
  row,
  canEdit,
  onSaved,
}: {
  row: PendingRow;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(row.estimatedAmount != null ? String(row.estimatedAmount) : '');
  const [note, setNote] = useState(row.estimatedNote ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const hasEstimate = row.estimatedAmount != null;
  // Diferencia del estimado contra lo planillado por el sistema.
  const diff = hasEstimate ? (row.estimatedAmount as number) - row.totalCurrent : 0;

  const save = async (clear = false) => {
    setSaving(true);
    setErr(null);
    try {
      const amount = clear || val.trim() === '' ? null : Number(val);
      if (amount != null && (Number.isNaN(amount) || amount < 0)) {
        setErr('Monto inválido');
        setSaving(false);
        return;
      }
      await apiPatch(`/planillas/${row.id}/estimate`, {
        estimatedAmount: amount,
        estimatedNote: amount == null ? null : note.trim() || null,
      });
      setEditing(false);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="mt-2 border-t border-surface-border pt-2 text-[11px]">
        {hasEstimate ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink-tertiary">Estimado</span>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-brand">
                {formatCurrency(row.estimatedAmount as number)}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded px-1 text-ink-tertiary hover:text-ink-primary"
                  title="Editar estimado"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>
        ) : canEdit ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] text-brand hover:underline"
          >
            + Valor estimado
          </button>
        ) : null}
        {hasEstimate && diff !== 0 && (
          <div className="mt-0.5 flex items-center justify-between text-[10px] text-ink-tertiary">
            <span>Dif. vs planillado</span>
            <span className={diff > 0 ? 'text-success' : 'text-danger'}>
              {diff > 0 ? '+' : ''}
              {formatCurrency(diff)}
            </span>
          </div>
        )}
        {hasEstimate && row.estimatedNote && (
          <div className="mt-0.5 truncate text-[10px] italic text-ink-tertiary" title={row.estimatedNote}>
            {row.estimatedNote}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1.5 border-t border-surface-border pt-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-ink-tertiary">$</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Valor estimado"
          autoFocus
          className="input h-8 flex-1 text-xs"
        />
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota (opcional)"
        maxLength={300}
        className="input h-8 w-full text-xs"
      />
      {err && <div className="text-[10px] text-danger">{err}</div>}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={saving}
          className="btn-primary h-7 px-2 text-[11px] disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setVal(row.estimatedAmount != null ? String(row.estimatedAmount) : '');
            setNote(row.estimatedNote ?? '');
            setErr(null);
          }}
          disabled={saving}
          className="btn-secondary h-7 px-2 text-[11px]"
        >
          Cancelar
        </button>
        {hasEstimate && (
          <button
            type="button"
            onClick={() => save(true)}
            disabled={saving}
            className="ml-auto text-[11px] text-danger hover:underline disabled:opacity-50"
          >
            Borrar
          </button>
        )}
      </div>
    </div>
  );
}
