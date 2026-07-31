'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { CreateIncidenciaModal, MODULE_OPTIONS } from '@/components/forms/CreateIncidenciaModal';
import { IncidenciaDetail } from '@/components/forms/IncidenciaDetail';
import { SentinelTimer, ResolutionEta } from '@/components/ui/SentinelTimer';
import { apiGet } from '@/lib/api';
import { formatCalendarDate } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type {
  Incidencia,
  IncidenciasOverview,
  IncidenciaStatus,
  IncidenciaUrgency,
} from '@/types';

const STATUS_LABEL: Record<IncidenciaStatus, string> = {
  ABIERTA: 'Abierta',
  EN_REVISION: 'En revisión',
  RESUELTA: 'Resuelta',
  CERRADA: 'Cerrada',
};
const STATUS_CLASS: Record<IncidenciaStatus, string> = {
  ABIERTA: 'badge-danger',
  EN_REVISION: 'badge-warn',
  RESUELTA: 'badge-ok',
  CERRADA: 'badge-muted',
};
const URGENCY_LABEL: Record<IncidenciaUrgency, string> = {
  ALTA: '🔴 Alta',
  MEDIA: '🟡 Media',
  BAJA: '🟢 Baja',
};

const MODULE_LABEL = Object.fromEntries(MODULE_OPTIONS.map((m) => [m.value, m.label]));

export default function SoportePage() {
  const { data, isLoading, error, mutate } = useSWR<IncidenciasOverview>(
    '/incidencias',
    apiGet,
  );
  const canWrite = useAuthStore().can('incidencias.write');
  const [showCreate, setShowCreate] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // Filtro por estado. null = todas menos cerradas (lo pendiente); 'ALL' = todo.
  const [filter, setFilter] = useState<IncidenciaStatus | 'ALL' | 'PENDING'>('PENDING');
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    let list = data?.items ?? [];
    if (filter === 'PENDING')
      list = list.filter((i) => i.status === 'ABIERTA' || i.status === 'EN_REVISION');
    else if (filter !== 'ALL') list = list.filter((i) => i.status === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          `#${i.number}`.includes(q),
      );
    }
    return list;
  }, [data, filter, query]);

  const counts = data?.counts;
  const pendingCount = counts ? counts.ABIERTA + counts.EN_REVISION : 0;

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Soporte</h1>
          <p className="text-xs text-ink-secondary">
            Reporta un problema del sistema y sigue su solución en un solo lugar
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            + Reportar problema
          </button>
        )}
      </div>

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}
      {error && (
        <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          {/* Timer del vigilante: próxima revisión (o "en pausa" si el loop paró) */}
          <SentinelTimer sentinel={data.sentinel} />

          {/* Resumen por estado: se toca para filtrar */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Pendientes"
              value={pendingCount}
              active={filter === 'PENDING'}
              tone="danger"
              onClick={() => setFilter('PENDING')}
            />
            <StatCard
              label={STATUS_LABEL.ABIERTA}
              value={counts?.ABIERTA ?? 0}
              active={filter === 'ABIERTA'}
              tone="danger"
              onClick={() => setFilter('ABIERTA')}
            />
            <StatCard
              label={STATUS_LABEL.RESUELTA}
              value={counts?.RESUELTA ?? 0}
              active={filter === 'RESUELTA'}
              tone="success"
              onClick={() => setFilter('RESUELTA')}
            />
            <StatCard
              label={STATUS_LABEL.CERRADA}
              value={counts?.CERRADA ?? 0}
              active={filter === 'CERRADA'}
              onClick={() => setFilter('CERRADA')}
            />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input max-w-xs text-sm"
              placeholder="🔍 Buscar…"
            />
            <button
              onClick={() => setFilter('ALL')}
              className={`rounded-full border px-3 py-1 text-xs ${
                filter === 'ALL'
                  ? 'border-brand bg-brand text-white'
                  : 'border-surface-border text-ink-secondary hover:text-ink-primary'
              }`}
            >
              Ver todas
            </button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-surface-border bg-surface-muted/40 p-10 text-center text-sm text-ink-secondary">
              {filter === 'PENDING'
                ? '🎉 No hay incidencias pendientes.'
                : 'No hay incidencias que coincidan.'}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((inc) => (
                <IncidenciaRow
                  key={inc.id}
                  inc={inc}
                  sentinel={data.sentinel}
                  onClick={() => setOpenId(inc.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <CreateIncidenciaModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={() => mutate()}
      />
      <IncidenciaDetail
        id={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => mutate()}
      />
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  active,
  tone = 'default',
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  tone?: 'default' | 'danger' | 'success';
  onClick: () => void;
}) {
  const valueColour =
    tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-ink-primary';
  return (
    <button
      onClick={onClick}
      className={`metric-card text-left transition-all ${
        active ? 'ring-2 ring-brand' : 'hover:border-brand/50'
      }`}
    >
      <div className="text-xs text-ink-secondary">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${valueColour}`}>{value}</div>
    </button>
  );
}

function IncidenciaRow({
  inc,
  sentinel,
  onClick,
}: {
  inc: Incidencia;
  sentinel: IncidenciasOverview['sentinel'];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start justify-between gap-3 rounded-lg border border-surface-border bg-surface p-3 text-left transition-all hover:border-brand/60 hover:shadow-card"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-ink-tertiary">#{inc.number}</span>
          <span className="truncate text-sm font-semibold text-ink-primary">{inc.title}</span>
        </div>
        <div className="mt-1 line-clamp-1 text-[11px] text-ink-secondary">{inc.description}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="badge-muted">{MODULE_LABEL[inc.module] ?? inc.module}</span>
          <span className="text-ink-tertiary">{URGENCY_LABEL[inc.urgency]}</span>
          {inc.imageMime && <span className="text-ink-tertiary">📎</span>}
          {(inc._count?.messages ?? 0) > 0 && (
            <span className="text-ink-tertiary">💬 {inc._count?.messages}</span>
          )}
          <span className="text-ink-tertiary">· {formatCalendarDate(inc.createdAt)}</span>
          <ResolutionEta status={inc.status} sentinel={sentinel} />
        </div>
      </div>
      <span className={`${STATUS_CLASS[inc.status]} shrink-0`}>{STATUS_LABEL[inc.status]}</span>
    </button>
  );
}
