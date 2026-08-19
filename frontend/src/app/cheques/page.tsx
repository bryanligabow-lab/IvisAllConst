'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { CreateChequeModal } from '@/components/forms/CreateChequeModal';
import { CreateChequeGroupModal } from '@/components/forms/CreateChequeGroupModal';
import { apiGet, apiPost } from '@/lib/api';
import { formatCurrency, formatCalendarDate } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type {
  Cheque,
  ChequeStatus,
  ChequesOverview,
  ChequeGroupSummary,
  ChequeGroupDetail,
} from '@/types';

const STATUS_BADGE: Record<ChequeStatus, string> = {
  PENDIENTE: 'badge-warn',
  COBRADO: 'badge-ok',
  VENCIDO: 'badge-danger',
  ANULADO: 'badge-muted',
};
const STATUS_LABEL: Record<ChequeStatus, string> = {
  PENDIENTE: 'Pendiente',
  COBRADO: 'Cobrado',
  VENCIDO: 'Vencido',
  ANULADO: 'Anulado',
};

export default function ChequesPage() {
  const canWrite = useAuthStore().can('cheques.write');
  const [tab, setTab] = useState<'registro' | 'maquinaria'>('registro');

  const { data: overview, mutate: mutateOverview } = useSWR<ChequesOverview>(
    '/cheques/overview',
    apiGet,
  );

  const refreshAll = () => {
    mutateOverview();
  };

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Cheques</h1>
        <p className="text-xs text-ink-secondary">
          Control de cheques y financiamientos de maquinaria
        </p>
      </div>

      {/* KPIs */}
      {overview && (
        <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Kpi label="Emitido" value={formatCurrency(overview.totals.emitido)} />
          <Kpi label="Cobrado" value={formatCurrency(overview.totals.cobrado)} tone="success" />
          <Kpi
            label="Pendiente"
            value={formatCurrency(overview.totals.pendiente)}
            hint={`${overview.totals.countPendiente} cheques`}
            tone="warning"
          />
          <Kpi label="Cheques" value={String(overview.totals.count)} />
        </div>
      )}

      {/* Próximos a cobrar — la alerta */}
      {overview && overview.proximos.length > 0 && (
        <ProximosAlert overview={overview} />
      )}

      {/* Tabs */}
      <div className="mb-3 flex gap-2 border-b border-surface-border">
        <TabBtn active={tab === 'registro'} onClick={() => setTab('registro')}>
          Registro
        </TabBtn>
        <TabBtn active={tab === 'maquinaria'} onClick={() => setTab('maquinaria')}>
          Maquinaria
        </TabBtn>
      </div>

      {tab === 'registro' ? (
        <RegistroTab bancos={overview?.bancos ?? []} canWrite={canWrite} onChanged={refreshAll} />
      ) : (
        <MaquinariaTab bancos={overview?.bancos ?? []} canWrite={canWrite} onChanged={refreshAll} />
      )}
    </AppShell>
  );
}

function ProximosAlert({ overview }: { overview: ChequesOverview }) {
  const [open, setOpen] = useState(true);
  const overdue = overview.proximos.filter((p) => p.overdue).length;
  return (
    <div className="mb-4 rounded-lg border border-warning/40 bg-warning-soft/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🔔</span>
          <div>
            <div className="text-sm font-semibold text-ink-primary">
              Próximos a cobrar ({overview.proximos.length})
            </div>
            <div className="text-[11px] text-ink-secondary">
              {formatCurrency(overview.proximosMonto)}
              {overdue > 0 && <span className="text-danger"> · {overdue} atrasados</span>}
            </div>
          </div>
        </div>
        <span className="text-ink-tertiary">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="max-h-72 space-y-1.5 overflow-y-auto px-3 pb-3">
          {overview.proximos.slice(0, 40).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-md bg-surface px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-ink-primary">
                  {p.beneficiary || p.groupName || 'Sin beneficiario'}
                  {p.number ? ` · #${p.number}` : ''}
                </div>
                <div className="text-[10px] text-ink-tertiary">
                  {p.bank ?? ''} · {formatCalendarDate(p.issueDate)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold">{formatCurrency(p.amount)}</div>
                <div className={`text-[10px] ${p.overdue ? 'text-danger' : 'text-warning'}`}>
                  {p.overdue
                    ? `atrasado ${Math.abs(p.daysUntil)}d`
                    : p.daysUntil === 0
                      ? 'hoy'
                      : `en ${p.daysUntil}d`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Registro ----

function RegistroTab({
  bancos,
  canWrite,
  onChanged,
}: {
  bancos: string[];
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<ChequeStatus | 'ALL'>('PENDIENTE');
  const [bank, setBank] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(30);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Cheque | null>(null);

  const params = new URLSearchParams();
  if (status !== 'ALL') params.set('status', status);
  if (bank) params.set('bank', bank);
  if (q.trim()) params.set('q', q.trim());
  const { data, isLoading, mutate } = useSWR<Cheque[]>(`/cheques?${params.toString()}`, apiGet);

  const refresh = () => {
    mutate();
    onChanged();
  };

  const shown = (data ?? []).slice(0, limit);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Buscar beneficiario, nº…"
          className="input min-w-[160px] flex-1 text-sm"
        />
        <select value={bank} onChange={(e) => setBank(e.target.value)} className="input text-sm">
          <option value="">Todos los bancos</option>
          {bancos.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        {canWrite && (
          <button onClick={() => setShowCreate(true)} className="btn-primary whitespace-nowrap text-sm">
            + Nuevo cheque
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(['PENDIENTE', 'COBRADO', 'ANULADO', 'ALL'] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s);
              setLimit(30);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              status === s
                ? 'border-brand bg-brand text-white'
                : 'border-surface-border text-ink-secondary hover:text-ink-primary'
            }`}
          >
            {s === 'ALL' ? 'Todos' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}
      {data && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-surface-border bg-surface-muted/40 p-8 text-center text-sm text-ink-secondary">
          No hay cheques con estos filtros.
        </div>
      )}

      <div className="space-y-2">
        {shown.map((c) => (
          <ChequeCard
            key={c.id}
            cheque={c}
            canWrite={canWrite}
            onEdit={() => setEditing(c)}
            onChanged={refresh}
          />
        ))}
      </div>

      {data && data.length > limit && (
        <button
          onClick={() => setLimit((l) => l + 50)}
          className="mt-3 w-full rounded-md border border-surface-border py-2.5 text-sm text-ink-secondary hover:border-brand/60 hover:text-ink-primary"
        >
          Ver más ({data.length - limit} restantes)
        </button>
      )}

      <CreateChequeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={refresh}
        bancos={bancos}
      />
      <CreateChequeModal
        open={!!editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
        initial={editing}
        bancos={bancos}
      />
    </div>
  );
}

function ChequeCard({
  cheque: c,
  canWrite,
  onEdit,
  onChanged,
}: {
  cheque: Cheque;
  canWrite: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggleCashed(cashed: boolean) {
    setBusy(true);
    try {
      await apiPost(`/cheques/${c.id}/cash`, { cashed });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-surface-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink-primary">
            {c.beneficiary || 'Sin beneficiario'}
          </div>
          <div className="truncate text-[11px] text-ink-secondary">
            {c.number ? `Cheque #${c.number}` : 'Sin número'}
            {c.bank ? ` · ${c.bank}` : ''}
          </div>
        </div>
        <span className={`${STATUS_BADGE[c.status]} shrink-0`}>{STATUS_LABEL[c.status]}</span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <div className="text-lg font-semibold tracking-tight">{formatCurrency(c.amount)}</div>
          <div className="text-[10px] text-ink-tertiary">
            📅 Emitido {formatCalendarDate(c.issueDate)}
            {c.status === 'COBRADO' && c.cashDate ? ` · Cobrado ${formatCalendarDate(c.cashDate)}` : ''}
          </div>
        </div>
        {canWrite && (
          <div className="flex shrink-0 items-center gap-1.5">
            {c.status === 'PENDIENTE' && (
              <button
                onClick={() => toggleCashed(true)}
                disabled={busy}
                className="rounded-md bg-success px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                ✓ Cobrado
              </button>
            )}
            {c.status === 'COBRADO' && (
              <button
                onClick={() => toggleCashed(false)}
                disabled={busy}
                className="rounded-md border border-surface-border px-2 py-1.5 text-[11px] text-ink-secondary disabled:opacity-50"
              >
                Deshacer
              </button>
            )}
            <button
              onClick={onEdit}
              className="rounded-md px-1.5 py-1.5 text-ink-tertiary hover:text-ink-primary"
              title="Editar"
            >
              ✏️
            </button>
          </div>
        )}
      </div>
      {c.notes && <div className="mt-1 text-[10px] italic text-ink-tertiary">{c.notes}</div>}
    </div>
  );
}

// ---- Maquinaria ----

function MaquinariaTab({
  bancos,
  canWrite,
  onChanged,
}: {
  bancos: string[];
  canWrite: boolean;
  onChanged: () => void;
}) {
  const { data: groups, isLoading, mutate } = useSWR<ChequeGroupSummary[]>('/cheques/groups', apiGet);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = () => {
    mutate();
    onChanged();
  };

  return (
    <div>
      {canWrite && (
        <div className="mb-3 flex justify-end">
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
            + Financiamiento
          </button>
        </div>
      )}

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}
      {groups && groups.length === 0 && (
        <div className="rounded-lg border border-dashed border-surface-border bg-surface-muted/40 p-8 text-center text-sm text-ink-secondary">
          Aún no hay financiamientos. Usa <strong>+ Financiamiento</strong> para agregar una
          maquinaria pagada a cuotas.
        </div>
      )}

      <div className="space-y-3">
        {(groups ?? []).map((g) => (
          <GroupCard key={g.id} group={g} canWrite={canWrite} onChanged={refresh} />
        ))}
      </div>

      <CreateChequeGroupModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={refresh}
        bancos={bancos}
      />
    </div>
  );
}

function GroupCard({
  group: g,
  canWrite,
  onChanged,
}: {
  group: ChequeGroupSummary;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pct = g.cuotas > 0 ? Math.round((g.pagadas / g.cuotas) * 100) : 0;

  const { data: detail, mutate } = useSWR<ChequeGroupDetail>(
    open ? `/cheques/groups/${g.id}` : null,
    apiGet,
  );

  const refresh = () => {
    mutate();
    onChanged();
  };

  return (
    <div className="rounded-lg border border-surface-border bg-surface">
      <button onClick={() => setOpen((v) => !v)} className="w-full p-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink-primary">🚜 {g.name}</div>
            {g.source && <div className="truncate text-[11px] text-ink-secondary">{g.source}</div>}
          </div>
          <span className="shrink-0 text-ink-tertiary">{open ? '▾' : '▸'}</span>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] text-ink-tertiary">Faltan</div>
            <div className="text-base font-semibold text-danger">{g.faltan}</div>
            <div className="text-[9px] text-ink-tertiary">de {g.cuotas} cuotas</div>
          </div>
          <div>
            <div className="text-[10px] text-ink-tertiary">Saldo</div>
            <div className="text-base font-semibold text-warning">{formatCurrency(g.saldo)}</div>
          </div>
          <div>
            <div className="text-[10px] text-ink-tertiary">Total</div>
            <div className="text-base font-semibold">{formatCurrency(g.total)}</div>
          </div>
        </div>

        <div className="mt-2">
          <div className="mb-0.5 flex justify-between text-[10px] text-ink-secondary">
            <span>{g.pagadas} pagadas</span>
            <span>{pct}%</span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full bg-success transition-all" style={{ width: `${pct}%` }} />
          </div>
          {g.nextDue && (
            <div className="mt-1 text-[10px] text-ink-tertiary">
              Próxima cuota: {formatCalendarDate(g.nextDue)}
            </div>
          )}
        </div>
      </button>

      {open && detail && (
        <div className="border-t border-surface-border p-3">
          <div className="space-y-1.5">
            {detail.cheques.map((c) => (
              <GroupChequeRow key={c.id} cheque={c} canWrite={canWrite} onChanged={refresh} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupChequeRow({
  cheque: c,
  canWrite,
  onChanged,
}: {
  cheque: Cheque;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const cobrado = c.status === 'COBRADO';

  async function toggle() {
    setBusy(true);
    try {
      await apiPost(`/cheques/${c.id}/cash`, { cashed: !cobrado });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-surface-muted/40 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs font-medium">
          Cuota {c.installment ?? '—'}
          {c.number ? ` · #${c.number}` : ''}
        </div>
        <div className="text-[10px] text-ink-tertiary">{formatCalendarDate(c.issueDate)}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs font-semibold">{formatCurrency(c.amount)}</span>
        {canWrite ? (
          <button
            onClick={toggle}
            disabled={busy}
            className={`rounded-md px-2 py-1 text-[11px] font-medium disabled:opacity-50 ${
              cobrado
                ? 'border border-surface-border text-ink-secondary'
                : 'bg-success text-white'
            }`}
          >
            {cobrado ? 'Pagada ✓' : 'Pagar'}
          </button>
        ) : (
          <span className={cobrado ? 'badge-ok' : 'badge-warn'}>
            {cobrado ? 'Pagada' : 'Pendiente'}
          </span>
        )}
      </div>
    </div>
  );
}

// ---- pequeños ----

function Kpi({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const colour =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'danger'
          ? 'text-danger'
          : 'text-ink-primary';
  return (
    <div className="metric-card">
      <div className="text-[11px] text-ink-secondary">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tracking-tight ${colour}`}>{value}</div>
      {hint && <div className="text-[10px] text-ink-tertiary">{hint}</div>}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${
        active
          ? 'border-brand text-brand'
          : 'border-transparent text-ink-secondary hover:text-ink-primary'
      }`}
    >
      {children}
    </button>
  );
}
