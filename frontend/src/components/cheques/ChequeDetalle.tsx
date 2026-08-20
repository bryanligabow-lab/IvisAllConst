'use client';

import { useState } from 'react';
import { apiPost, apiPatch, ApiClientError } from '@/lib/api';
import { formatCurrency, formatCalendarDate } from '@/lib/format';
import type { Cheque, ChequeStatus, Chequera } from '@/types';

const STATUS_LABEL: Record<ChequeStatus, string> = {
  PENDIENTE: 'Pendiente',
  COBRADO: 'Cobrado',
  VENCIDO: 'Vencido',
  ANULADO: 'Anulado',
};
const STATUS_BADGE: Record<ChequeStatus, string> = {
  PENDIENTE: 'badge-warn',
  COBRADO: 'badge-ok',
  VENCIDO: 'badge-danger',
  ANULADO: 'badge-muted',
};

/** Detalle de un cheque: todos sus datos y las acciones para cambiarle el estado. */
export function ChequeDetalle({
  cheque,
  chequeras,
  canWrite,
  onBack,
  onChanged,
  onEdit,
}: {
  cheque: Cheque;
  chequeras: Chequera[];
  canWrite: boolean;
  onBack: () => void;
  onChanged: () => void;
  onEdit: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cobrado = cheque.status === 'COBRADO';
  const chequera = chequeras.find((c) => c.id === cheque.chequeraId);
  const due = cheque.dueDate ?? cheque.issueDate;
  const dias = due
    ? Math.round(
        (new Date(due).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000,
      )
    : null;

  async function toggle() {
    setBusy(true);
    setErr(null);
    try {
      await apiPost(`/cheques/${cheque.id}/cash`, { cashed: !cobrado });
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'No se pudo cambiar');
    } finally {
      setBusy(false);
    }
  }

  async function anular() {
    setBusy(true);
    setErr(null);
    try {
      await apiPatch(`/cheques/${cheque.id}`, { status: 'ANULADO' });
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'No se pudo anular');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={onBack} className="mb-3 text-xs font-bold text-brand">
        ← Volver
      </button>

      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[.1em] text-brand">
            Cheque {cheque.number ? `#${cheque.number}` : 'sin número'}
          </div>
          <div className="text-[34px] font-bold leading-[1.05] tracking-[-.02em]">
            {formatCurrency(cheque.amount)}
          </div>
          <div className="truncate text-[13px] text-ink-secondary">
            {cheque.beneficiary || 'Sin beneficiario'}
          </div>
        </div>
        <span className={`${STATUS_BADGE[cheque.status]} shrink-0`}>
          {STATUS_LABEL[cheque.status]}
        </span>
      </div>

      {/* Tabla de datos */}
      <div className="mt-4 border-t-2 border-surface-border">
        <Dato k="Estado" v={STATUS_LABEL[cheque.status]} />
        <Dato k="Chequera" v={chequera?.corto ?? cheque.bank ?? '—'} />
        {chequera && <Dato k="Banco" v={chequera.banco} />}
        <Dato k="Beneficiario" v={cheque.beneficiary ?? '—'} />
        <Dato k="Emisión" v={formatCalendarDate(cheque.issueDate)} />
        <Dato
          k="Se cobra el"
          v={
            due
              ? `${formatCalendarDate(due)}${
                  !cobrado && dias !== null
                    ? dias < 0
                      ? ` (venció hace ${Math.abs(dias)} d)`
                      : dias === 0
                        ? ' (hoy)'
                        : ` (en ${dias} d)`
                    : ''
                }`
              : '—'
          }
        />
        {cobrado && <Dato k="Cobrado el" v={formatCalendarDate(cheque.cashDate)} />}
        {cheque.installment != null && <Dato k="Cuota" v={`#${cheque.installment}`} />}
        {cheque.notes && <Dato k="Observaciones" v={cheque.notes} />}
      </div>

      {err && <div className="mt-3 bg-danger-soft px-3 py-2 text-sm text-danger">{err}</div>}

      {/* Acciones */}
      {canWrite && (
        <div className="mt-4 border-t-2 border-surface-border pt-3">
          <button
            onClick={toggle}
            disabled={busy || cheque.status === 'ANULADO'}
            className="w-full bg-brand py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? 'Guardando…' : cobrado ? 'Marcar como pendiente' : 'Marcar como cobrado'}
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={onEdit} className="btn-secondary text-xs">
              Editar
            </button>
            <button
              onClick={anular}
              disabled={busy || cheque.status === 'ANULADO'}
              className="btn-secondary text-xs disabled:opacity-50"
            >
              Anular
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-surface-border py-2">
      <span className="shrink-0 text-[13px] text-ink-tertiary">{k}</span>
      <span className="text-right text-[13px] font-semibold text-ink-primary">{v}</span>
    </div>
  );
}
