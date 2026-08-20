'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { apiGet, apiPost } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Cheque } from '@/types';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

const DOT: Record<string, string> = {
  PENDIENTE: 'bg-warning',
  COBRADO: 'bg-success',
  VENCIDO: 'bg-danger',
  ANULADO: 'bg-ink-tertiary',
};

/** Día (YYYY-MM-DD) en que se cobra: la fecha de cobro o, si no hay, la de emisión. */
function dueKey(c: Cheque): string | null {
  const d = c.dueDate ?? c.issueDate;
  return d ? d.slice(0, 10) : null;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// Calendario de cobros: cada día muestra un punto por cheque; al tocar el día
// se listan sus cheques y se pueden marcar cobrados ahí mismo.
export function ChequesCalendar({
  canWrite,
  onChanged,
}: {
  canWrite: boolean;
  onChanged: () => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-11
  const [selected, setSelected] = useState<string | null>(
    `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
  );

  const from = `${year}-${pad(month + 1)}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${pad(month + 1)}-${pad(lastDay)}`;

  const { data, mutate } = useSWR<Cheque[]>(
    `/cheques?scope=all&from=${from}&to=${to}`,
    apiGet,
  );

  const byDay = useMemo(() => {
    const m = new Map<string, Cheque[]>();
    for (const c of data ?? []) {
      const k = dueKey(c);
      if (!k) continue;
      const arr = m.get(k) ?? [];
      arr.push(c);
      m.set(k, arr);
    }
    return m;
  }, [data]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: lastDay }, (_, i) => i + 1),
  ];

  const move = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(null);
  };

  const selectedCheques = selected ? (byDay.get(selected) ?? []) : [];
  const selectedTotal = selectedCheques.reduce((s, c) => s + c.amount, 0);
  const monthTotal = (data ?? [])
    .filter((c) => c.status === 'PENDIENTE')
    .reduce((s, c) => s + c.amount, 0);

  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  return (
    <div>
      {/* Navegación de mes */}
      <div className="mb-2 flex items-center justify-between border-b border-surface-border pb-2">
        <button
          onClick={() => move(-1)}
          className="rounded-md px-3 py-2 text-sm text-ink-secondary hover:bg-surface-muted"
          aria-label="Mes anterior"
        >
          ←
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold">
            {MESES[month]} {year}
          </div>
          {monthTotal > 0 && (
            <div className="text-[10px] text-warning">
              {formatCurrency(monthTotal)} por cobrar
            </div>
          )}
        </div>
        <button
          onClick={() => move(1)}
          className="rounded-md px-3 py-2 text-sm text-ink-secondary hover:bg-surface-muted"
          aria-label="Mes siguiente"
        >
          →
        </button>
      </div>

      {/* Encabezados de días */}
      <div className="grid grid-cols-7 text-center">
        {DIAS.map((d) => (
          <div key={d} className="py-1 text-[10px] uppercase text-ink-tertiary">
            {d}
          </div>
        ))}
      </div>

      {/* Celdas */}
      <div className="grid grid-cols-7 overflow-hidden rounded-md border border-surface-border">
        {cells.map((day, i) => {
          if (day === null)
            return <div key={`e${i}`} className="h-14 bg-surface-muted/40 border-b border-r border-surface-border" />;
          const key = `${year}-${pad(month + 1)}-${pad(day)}`;
          const list = byDay.get(key) ?? [];
          const isSel = selected === key;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`h-14 border-b border-r border-surface-border p-1 text-left transition-colors ${
                isSel ? 'bg-brand/15' : list.length > 0 ? 'hover:bg-surface-muted' : ''
              }`}
            >
              <div
                className={`text-[11px] ${
                  isToday
                    ? 'inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand font-bold text-white'
                    : isSel
                      ? 'font-bold text-brand'
                      : 'text-ink-secondary'
                }`}
              >
                {day}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-0.5">
                {list.slice(0, 6).map((c) => (
                  <span
                    key={c.id}
                    className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[c.status] ?? 'bg-ink-tertiary'}`}
                  />
                ))}
                {list.length > 6 && (
                  <span className="text-[8px] leading-none text-ink-tertiary">+{list.length - 6}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-ink-tertiary">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" /> Pendiente
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" /> Cobrado
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-tertiary" /> Anulado
        </span>
      </div>

      {/* Cheques del día */}
      {selected && (
        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between border-b border-surface-border pb-1">
            <h3 className="text-sm font-semibold">
              {Number(selected.slice(8))} de {MESES[month]}
            </h3>
            {selectedCheques.length > 0 && (
              <span className="text-xs text-ink-secondary">{formatCurrency(selectedTotal)}</span>
            )}
          </div>
          {selectedCheques.length === 0 ? (
            <div className="py-4 text-center text-xs text-ink-tertiary">Sin cheques este día.</div>
          ) : (
            <div className="space-y-1.5">
              {selectedCheques.map((c) => (
                <DayRow
                  key={c.id}
                  cheque={c}
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
      )}
    </div>
  );
}

function DayRow({
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
    <div className="flex items-center justify-between gap-2 rounded-md border border-surface-border bg-surface px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-ink-primary">
          {c.beneficiary || 'Sin beneficiario'}
        </div>
        <div className="truncate text-[10px] text-ink-tertiary">
          {c.number ? `#${c.number}` : 'sin nº'}
          {c.bank ? ` · ${c.bank}` : ''}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs font-semibold">{formatCurrency(c.amount)}</span>
        {canWrite && c.status !== 'ANULADO' ? (
          <button
            onClick={toggle}
            disabled={busy}
            className={`rounded-md px-2 py-1 text-[11px] font-medium disabled:opacity-50 ${
              cobrado ? 'border border-surface-border text-ink-secondary' : 'bg-success text-white'
            }`}
          >
            {cobrado ? 'Cobrado ✓' : 'Marcar'}
          </button>
        ) : (
          <span className={cobrado ? 'badge-ok' : 'badge-warn'}>{cobrado ? 'Cobrado' : 'Pend.'}</span>
        )}
      </div>
    </div>
  );
}
