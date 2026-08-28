'use client';

import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { CreateChequeModal } from '@/components/forms/CreateChequeModal';
import { CreateChequeGroupModal } from '@/components/forms/CreateChequeGroupModal';
import { ChequesCalendar } from '@/components/ui/ChequesCalendar';
import { ResumenTab } from '@/components/cheques/ResumenTab';
import { CuentasTab } from '@/components/cheques/CuentasTab';
import { ChequeDetalle } from '@/components/cheques/ChequeDetalle';
import { AvisosField } from '@/components/cheques/AvisosField';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { formatCurrency, formatCalendarDate } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type {
  Cheque,
  ChequeStatus,
  Chequera,
  ChequeGroupSummary,
  ChequeGroupDetail,
  ChequeGroupAvisos,
} from '@/types';

type Vista = 'resumen' | 'cheques' | 'calendario' | 'financiamientos' | 'cuentas';

const TABS: { id: Vista; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'cheques', label: 'Cheques' },
  { id: 'calendario', label: 'Calend.' },
  { id: 'financiamientos', label: 'Financ.' },
  { id: 'cuentas', label: 'Cuentas' },
];

const STATUS_LABEL: Record<ChequeStatus, string> = {
  PENDIENTE: 'Pendiente',
  COBRADO: 'Cobrado',
  VENCIDO: 'Vencido',
  ANULADO: 'Anulado',
};
// Barra de color del estado (acento = pendiente, tinta = cobrado).
const STATUS_BAR: Record<ChequeStatus, string> = {
  PENDIENTE: 'bg-brand',
  COBRADO: 'bg-ink-primary',
  VENCIDO: 'bg-danger',
  ANULADO: 'bg-ink-tertiary',
};

export default function ChequesPage() {
  const canWrite = useAuthStore().can('cheques.write');
  const [vista, setVista] = useState<Vista>('resumen');
  const [detalle, setDetalle] = useState<Cheque | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Cheque | null>(null);
  const [filtroChequera, setFiltroChequera] = useState('');
  const [rev, setRev] = useState(0); // fuerza refresco de las vistas

  const { data: chequeras } = useSWR<Chequera[]>('/cheques/chequeras', apiGet);
  const { mutate } = useSWRConfig();
  // Tras cualquier cambio se invalida TODO lo que cuelga de /cheques, para que
  // un cheque recién creado aparezca de inmediato en la lista y en el resumen.
  const refresh = () => {
    mutate((key) => typeof key === 'string' && key.startsWith('/cheques'), undefined, {
      revalidate: true,
    });
    setRev((r) => r + 1);
  };

  const irACheques = (chequeraId = '') => {
    setFiltroChequera(chequeraId);
    setDetalle(null);
    setVista('cheques');
  };

  return (
    <AppShell>
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-[.1em] text-brand">Control de cheques</div>
        <h1 className="text-2xl font-bold tracking-tight">Chequera</h1>
      </div>

      {/* Tabs: 5 columnas, plano, sin esquinas redondeadas */}
      <div className="mb-4 grid grid-cols-5 border-y-2 border-surface-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setVista(t.id);
              setDetalle(null);
            }}
            className={`border-r border-surface-border py-2.5 text-[10px] font-bold uppercase tracking-[.06em] last:border-r-0 ${
              vista === t.id ? 'bg-ink-primary text-white' : 'text-ink-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {detalle ? (
        <ChequeDetalle
          cheque={detalle}
          chequeras={chequeras ?? []}
          canWrite={canWrite}
          onBack={() => setDetalle(null)}
          onEdit={() => setEditing(detalle)}
          onChanged={() => {
            refresh();
            setDetalle(null);
          }}
        />
      ) : (
        <>
          {vista === 'resumen' && (
            <ResumenTab
              key={rev}
              onVerCheques={() => irACheques()}
              onVerCalendario={() => setVista('calendario')}
              onVerMaquinas={() => setVista('financiamientos')}
            />
          )}
          {vista === 'cheques' && (
            <ChequesTab
              key={rev}
              chequeras={chequeras ?? []}
              chequeraId={filtroChequera}
              onChequera={setFiltroChequera}
              onOpen={setDetalle}
              canWrite={canWrite}
              onChanged={refresh}
            />
          )}
          {vista === 'calendario' && (
            <ChequesCalendar key={rev} canWrite={canWrite} onChanged={refresh} />
          )}
          {vista === 'financiamientos' && <FinanciamientosTab key={rev} canWrite={canWrite} onChanged={refresh} chequeras={chequeras ?? []} />}
          {vista === 'cuentas' && <CuentasTab key={rev} onVerCheques={irACheques} />}
        </>
      )}

      {canWrite && !detalle && (
        <button
          onClick={() => setShowCreate(true)}
          className="fixed bottom-6 right-4 z-40 bg-brand px-4 py-3.5 text-sm font-bold uppercase tracking-[.04em] text-white shadow-card"
        >
          + Cheque
        </button>
      )}

      <CreateChequeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={refresh}
        chequeras={chequeras ?? []}
      />
      <CreateChequeModal
        open={!!editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          refresh();
          setDetalle(null);
        }}
        initial={editing}
        chequeras={chequeras ?? []}
      />
    </AppShell>
  );
}

// ---------------- Cheques (lista) ----------------

function ChequesTab({
  chequeras,
  chequeraId,
  onChequera,
  onOpen,
  canWrite,
  onChanged,
}: {
  chequeras: Chequera[];
  chequeraId: string;
  onChequera: (id: string) => void;
  onOpen: (c: Cheque) => void;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [filtro, setFiltro] = useState<ChequeStatus | 'ALL'>('PENDIENTE');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(25);

  const params = new URLSearchParams({ scope: 'all' });
  if (filtro !== 'ALL') params.set('status', filtro);
  if (chequeraId) params.set('chequeraId', chequeraId);
  if (q.trim()) params.set('q', q.trim());
  const { data, isLoading, mutate } = useSWR<Cheque[]>(`/cheques?${params}`, apiGet);

  const lista = data ?? [];
  const total = lista.reduce((s, c) => s + c.amount, 0);
  const chequeraSel = chequeras.find((c) => c.id === chequeraId);

  return (
    <div>
      <div className="grid grid-cols-4 border-2 border-surface-border">
        {(['PENDIENTE', 'COBRADO', 'ANULADO', 'ALL'] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setFiltro(s);
              setLimit(25);
            }}
            className={`border-r border-surface-border py-2.5 text-[11px] font-bold uppercase tracking-[.04em] last:border-r-0 ${
              filtro === s ? 'bg-brand text-white' : 'text-ink-secondary'
            }`}
          >
            {s === 'PENDIENTE' ? 'Pend.' : s === 'ALL' ? 'Todos' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por número o beneficiario"
          className="input min-w-[150px] flex-1 text-sm"
        />
        <select
          value={chequeraId}
          onChange={(e) => onChequera(e.target.value)}
          className="input text-sm"
        >
          <option value="">Todas las chequeras</option>
          {chequeras.map((c) => (
            <option key={c.id} value={c.id}>
              {c.corto}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex items-center justify-between border-b border-surface-border py-2 text-[11px] text-ink-secondary">
        <span>
          {lista.length} cheques{chequeraSel ? ` · ${chequeraSel.corto}` : ''}
        </span>
        <span>Total {formatCurrency(total)}</span>
      </div>

      {isLoading && <div className="py-4 text-sm text-ink-secondary">Cargando…</div>}
      {!isLoading && lista.length === 0 && (
        <div className="py-10 text-center text-sm text-ink-tertiary">
          No hay cheques con estos filtros.
        </div>
      )}

      {lista.slice(0, limit).map((c) => (
        <FilaCheque
          key={c.id}
          cheque={c}
          canWrite={canWrite}
          onOpen={() => onOpen(c)}
          onChanged={() => {
            mutate();
            onChanged();
          }}
        />
      ))}

      {lista.length > limit && (
        <button
          onClick={() => setLimit((l) => l + 50)}
          className="mt-3 w-full border-2 border-surface-border py-2.5 text-xs font-bold uppercase text-ink-secondary"
        >
          Ver más ({lista.length - limit})
        </button>
      )}
      <div className="h-16" />
    </div>
  );
}

function FilaCheque({
  cheque: c,
  canWrite,
  onOpen,
  onChanged,
}: {
  cheque: Cheque;
  canWrite: boolean;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const due = c.dueDate ?? c.issueDate;

  async function marcar(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    try {
      await apiPost(`/cheques/${c.id}/cash`, { cashed: c.status !== 'COBRADO' });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onOpen}
      className="flex cursor-pointer items-center gap-3 border-b border-surface-border py-3"
    >
      <span className={`h-9 w-1.5 shrink-0 ${STATUS_BAR[c.status]}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink-primary">
          {c.beneficiary || 'Sin beneficiario'}
          {c.number && <span className="ml-1 text-[10px] text-ink-tertiary">#{c.number}</span>}
        </div>
        <div className="truncate text-[11px] text-ink-tertiary">
          {c.status === 'COBRADO'
            ? `cobrado ${formatCalendarDate(c.cashDate ?? due)}`
            : `cobro ${formatCalendarDate(due)}`}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[15px] font-bold">{formatCurrency(c.amount)}</div>
        <div className="text-[10px] uppercase text-ink-tertiary">{STATUS_LABEL[c.status]}</div>
      </div>
      {canWrite && c.status !== 'ANULADO' && (
        <button
          onClick={marcar}
          disabled={busy}
          className={`shrink-0 px-2 py-1.5 text-[10px] font-bold uppercase disabled:opacity-50 ${
            c.status === 'COBRADO'
              ? 'border border-surface-border text-ink-tertiary'
              : 'bg-success text-white'
          }`}
        >
          {c.status === 'COBRADO' ? '↩' : 'Cobrar'}
        </button>
      )}
    </div>
  );
}

// ---------------- Máquinas ----------------

function FinanciamientosTab({
  canWrite,
  onChanged,
  chequeras,
}: {
  canWrite: boolean;
  onChanged: () => void;
  chequeras: Chequera[];
}) {
  const { data, isLoading, mutate } = useSWR<ChequeGroupSummary[]>('/cheques/groups', apiGet);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [verCerrados, setVerCerrados] = useState(false);

  const grupos = data ?? [];
  const saldo = grupos.reduce((s, g) => s + g.saldo, 0);
  const restantes = grupos.reduce((s, g) => s + g.faltan, 0);
  // Arriba solo los que siguen vivos; los ya culminados van al final.
  const activos = grupos.filter((g) => g.faltan > 0);
  const cerrados = grupos.filter((g) => g.faltan === 0);
  const activas = activos.length;
  const pagadas = cerrados.length;

  const refresh = () => {
    mutate();
    onChanged();
  };

  if (isLoading) return <div className="py-6 text-sm text-ink-secondary">Cargando…</div>;

  return (
    <div>
      <div className="border-b-2 border-surface-border pb-3">
        <div className="text-[10px] uppercase tracking-[.1em] text-ink-secondary">
          Falta por cubrir
        </div>
        <div className="text-[32px] font-bold leading-none tracking-[-.02em]">
          {formatCurrency(saldo)}
        </div>
        <div className="mt-1 text-xs text-ink-tertiary">
          {restantes} {restantes === 1 ? 'cuota restante' : 'cuotas restantes'} en {activas}{' '}
          {activas === 1 ? 'financiamiento' : 'financiamientos'}
          {pagadas > 0 && ` · ${pagadas} ya pagada${pagadas === 1 ? '' : 's'}`}
        </div>
      </div>

      {activos.map((g) => (
        <FinanciamientoFila
          key={g.id}
          grupo={g}
          chequeras={chequeras}
          abierta={abierta === g.id}
          onToggle={() => setAbierta(abierta === g.id ? null : g.id)}
          canWrite={canWrite}
          onChanged={refresh}
        />
      ))}

      {activos.length === 0 && (
        <div className="py-8 text-center text-sm text-ink-tertiary">
          No hay financiamientos activos.
        </div>
      )}

      {/* Culminados: abajo, plegados, para que no estorben a los activos. */}
      {cerrados.length > 0 && (
        <div className="mt-5">
          <button
            onClick={() => setVerCerrados((v) => !v)}
            className="flex w-full items-center justify-between border-y-2 border-surface-border py-2.5 text-[10px] font-bold uppercase tracking-[.08em] text-ink-secondary"
          >
            <span>
              Culminados ({cerrados.length})
            </span>
            <span className="text-ink-tertiary">{verCerrados ? 'Ocultar ▲' : 'Ver ▼'}</span>
          </button>
          {verCerrados &&
            cerrados.map((g) => (
              <FinanciamientoFila
                key={g.id}
                grupo={g}
                chequeras={chequeras}
                abierta={abierta === g.id}
                onToggle={() => setAbierta(abierta === g.id ? null : g.id)}
                canWrite={canWrite}
                onChanged={refresh}
              />
            ))}
        </div>
      )}

      {canWrite && (
        <button
          onClick={() => setShowCreate(true)}
          className="mt-4 w-full border-2 border-surface-border py-2.5 text-xs font-bold uppercase text-ink-secondary"
        >
          + Financiamiento
        </button>
      )}
      <div className="h-16" />

      <CreateChequeGroupModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={refresh}
        chequeras={chequeras}
      />
    </div>
  );
}

function FinanciamientoFila({
  grupo: g,
  chequeras,
  abierta,
  onToggle,
  canWrite,
  onChanged,
}: {
  grupo: ChequeGroupSummary;
  chequeras: Chequera[];
  abierta: boolean;
  onToggle: () => void;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const { data: detalle, mutate } = useSWR<ChequeGroupDetail>(
    abierta ? `/cheques/groups/${g.id}` : null,
    apiGet,
  );
  const cuota = g.cuotas > 0 ? g.total / g.cuotas : 0;
  const pagada = g.faltan === 0;
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <EditarFinanciamiento
        grupo={g}
        onClose={() => setEditando(false)}
        onSaved={() => {
          setEditando(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <div className="border-b border-surface-border">
      <button onClick={onToggle} className="w-full py-3 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-base font-bold">{g.name}</span>
              {canWrite && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditando(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      setEditando(true);
                    }
                  }}
                  className="shrink-0 cursor-pointer px-1 text-xs text-ink-tertiary hover:text-brand"
                  title="Cambiar el nombre"
                >
                  ✏️
                </span>
              )}
            </div>
            {g.source && <div className="truncate text-[11px] text-ink-tertiary">{g.source}</div>}
          </div>
          <div className="shrink-0 text-right">
            <div className={`text-base font-bold ${pagada ? 'text-ink-tertiary' : 'text-brand'}`}>
              {pagada ? 'Pagada' : formatCurrency(g.saldo)}
            </div>
            {!pagada && (
              <div className="text-[10px] uppercase text-ink-tertiary">
                {g.faltan} {g.faltan === 1 ? 'cuota' : 'cuotas'}
              </div>
            )}
          </div>
        </div>

        {/* Barra segmentada: un segmento por cuota */}
        <div className="mt-2 flex gap-[3px]">
          {Array.from({ length: g.cuotas }, (_, i) => (
            <span key={i} className={`h-2 flex-1 ${i < g.pagadas ? 'bg-ink-primary' : 'bg-brand'}`} />
          ))}
        </div>

        <div className="mt-1.5 flex justify-between gap-2 text-[11px] text-ink-tertiary">
          <span className="truncate">
            {g.pagadas} de {g.cuotas} pagadas{cuota > 0 && ` · cuota ${formatCurrency(cuota)}`}
          </span>
          <span className="shrink-0">
            {pagada ? 'Cerrada' : g.nextDue ? `Termina ${formatCalendarDate(g.nextDue)}` : ''}
          </span>
        </div>
      </button>

      {abierta && detalle && (
        <div className="border-t border-surface-border bg-surface-muted/40 px-1 pb-2">
          {detalle.cheques.map((c) => (
            <CuotaFila
              key={c.id}
              cheque={c}
              chequeras={chequeras}
              canWrite={canWrite}
              onChanged={() => {
                mutate();
                onChanged();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CuotaFila({
  cheque: c,
  chequeras,
  canWrite,
  onChanged,
}: {
  cheque: Cheque;
  chequeras: Chequera[];
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const cobrado = c.status === 'COBRADO';
  // De qué chequera sale esta cuota (lo pidió la gerencia: ver dónde se cobra).
  const chequera = chequeras.find((q) => q.id === c.chequeraId)?.corto ?? null;

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
    <div className="flex items-center gap-2 border-b border-surface-border py-2 text-xs last:border-b-0">
      <span className="w-6 shrink-0 text-ink-tertiary">{c.installment ?? '—'}</span>
      <span className="w-[74px] shrink-0 font-semibold">
        {formatCalendarDate(c.dueDate ?? c.issueDate)}
      </span>
      <span className="min-w-0 flex-1 truncate text-ink-tertiary">
        {c.number ? `#${c.number}` : ''}
        {chequera && <span className="ml-1 text-[10px]">· {chequera}</span>}
      </span>
      <span className="w-[76px] shrink-0 text-right font-semibold">{formatCurrency(c.amount)}</span>
      {canWrite ? (
        <button
          onClick={toggle}
          disabled={busy}
          className={`shrink-0 px-2 py-1 text-[10px] font-bold uppercase disabled:opacity-50 ${
            cobrado ? 'border border-surface-border text-ink-tertiary' : 'bg-success text-white'
          }`}
        >
          {cobrado ? '✓' : 'Pagar'}
        </button>
      ) : (
        <span className={`h-2 w-2 shrink-0 ${cobrado ? 'bg-ink-primary' : 'bg-brand'}`} />
      )}
    </div>
  );
}

/** Editar un financiamiento: nombre, fuente y a quién avisarle por correo. */
function EditarFinanciamiento({
  grupo: g,
  onClose,
  onSaved,
}: {
  grupo: ChequeGroupSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: detalle } = useSWR<ChequeGroupDetail>(`/cheques/groups/${g.id}`, apiGet);
  const [name, setName] = useState(g.name);
  const [source, setSource] = useState(g.source ?? '');
  const [avisos, setAvisos] = useState<ChequeGroupAvisos | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Los avisos vienen en el detalle; se cargan una vez llega.
  useEffect(() => {
    if (!detalle || avisos) return;
    setAvisos({
      notifyEmails: detalle.notifyEmails ?? [],
      notifyWeekly: detalle.notifyWeekly ?? false,
      notifyMonthly: detalle.notifyMonthly ?? false,
      notifyDayBefore: detalle.notifyDayBefore ?? true,
      notifyOnDue: detalle.notifyOnDue ?? true,
    });
  }, [detalle, avisos]);

  async function guardar() {
    if (!name.trim()) {
      setErr('Ponle un nombre');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiPatch(`/cheques/groups/${g.id}`, {
        name: name.trim(),
        source: source.trim() || null,
        ...(avisos ?? {}),
      });
      onSaved();
    } catch {
      setErr('No se pudo guardar');
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-surface-border py-3">
      <div className="mb-1 text-[10px] uppercase tracking-[.06em] text-ink-secondary">
        Nombre del financiamiento
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        maxLength={120}
        className="input mb-2 w-full text-sm"
        placeholder="Ej. MIXER 1"
      />
      <div className="mb-1 text-[10px] uppercase tracking-[.06em] text-ink-secondary">
        Chequera / fuente
      </div>
      <input
        value={source}
        onChange={(e) => setSource(e.target.value)}
        maxLength={120}
        className="input mb-2 w-full text-sm"
      />

      {avisos && (
        <div className="mb-2">
          <AvisosField value={avisos} onChange={setAvisos} />
        </div>
      )}

      {err && <div className="mb-2 text-xs text-danger">{err}</div>}
      <div className="flex gap-2">
        <button onClick={guardar} disabled={busy} className="btn-primary text-xs disabled:opacity-50">
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
        <button onClick={onClose} className="btn-secondary text-xs">
          Cancelar
        </button>
      </div>
    </div>
  );
}
