'use client';

import useSWR from 'swr';
import { apiGet } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { ChequesResumen, ChequeResumenRow } from '@/types';

const MES_CORTO = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/**
 * Resumen: el estado del negocio en cinco segundos.
 * Cifra grande → par pendientes/cobrados → atención → próximos 7 días → maquinaria.
 */
export function ResumenTab({
  onVerCheques,
  onVerCalendario,
  onVerMaquinas,
}: {
  onVerCheques: () => void;
  onVerCalendario: () => void;
  onVerMaquinas: () => void;
}) {
  const { data, isLoading } = useSWR<ChequesResumen>('/cheques/resumen', apiGet);

  if (isLoading || !data) {
    return <div className="py-8 text-sm text-ink-secondary">Cargando cheques…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Cifra grande */}
      <div>
        <div className="text-[10px] uppercase tracking-[.1em] text-ink-secondary">
          Total pendiente
        </div>
        <div className="text-[40px] font-bold leading-none tracking-[-.02em] text-ink-primary">
          {formatCurrency(data.totalPendiente)}
        </div>
        <div className="mt-1 text-xs text-ink-tertiary">
          {data.countTotal} cheques · {data.countPendiente} por cobrar
        </div>
      </div>

      {/* 2. Par de celdas */}
      <div className="grid grid-cols-2 border-2 border-surface-border">
        <button onClick={onVerCheques} className="border-r-2 border-surface-border p-3 text-left">
          <div className="text-[10px] uppercase tracking-[.06em] text-ink-secondary">Pendientes</div>
          <div className="mt-0.5 text-xl font-bold text-brand">
            {formatCurrency(data.totalPendiente)}
          </div>
          <div className="text-[11px] text-ink-tertiary">{data.countPendiente} cheques</div>
        </button>
        <button onClick={onVerCheques} className="p-3 text-left">
          <div className="text-[10px] uppercase tracking-[.06em] text-ink-secondary">Cobrados</div>
          <div className="mt-0.5 text-xl font-bold text-ink-primary">
            {formatCurrency(data.totalCobrado)}
          </div>
          <div className="text-[11px] text-ink-tertiary">{data.countCobrado} cheques</div>
        </button>
      </div>

      {/* 3. Bloque de atención */}
      {data.atencion.length > 0 && (
        <div className="border-l-4 border-brand bg-brand/10 px-3 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[.06em] text-brand">
            Atención
          </div>
          <div className="mt-1.5 space-y-1">
            {data.atencion.map((r) => (
              <div key={r.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 flex-1 truncate text-ink-primary">
                  {r.beneficiary || 'Sin beneficiario'}
                  <span className="text-ink-tertiary">
                    {' '}
                    · {r.dias < 0 ? `venció hace ${Math.abs(r.dias)}d` : r.dias === 0 ? 'hoy' : `en ${r.dias}d`}
                  </span>
                </span>
                <span className="shrink-0 font-bold text-ink-primary">
                  {formatCurrency(r.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Próximos 7 días */}
      <div>
        <div className="flex items-baseline justify-between border-b-2 border-surface-border pb-1">
          <h2 className="text-[13px] font-bold uppercase tracking-[.06em]">Próximos 7 días</h2>
          <button onClick={onVerCalendario} className="text-[11px] font-bold text-brand">
            Calendario
          </button>
        </div>
        {data.proximos7.length === 0 ? (
          <div className="py-3 text-xs text-ink-tertiary">Sin cobros esta semana.</div>
        ) : (
          <div>
            {data.proximos7.map((r) => (
              <FilaProxima key={r.id} row={r} />
            ))}
          </div>
        )}
      </div>

      {/* 5. Maquinaria */}
      <button
        onClick={onVerMaquinas}
        className="border-2 border-surface-border p-3 text-left"
      >
        <div className="flex items-start justify-between">
          <div className="text-[10px] uppercase tracking-[.06em] text-ink-secondary">
            Maquinaria por cubrir
          </div>
          <span className="text-[11px] font-bold text-brand">Ver →</span>
        </div>
        <div className="mt-1 text-2xl font-bold tracking-[-.02em]">
          {formatCurrency(data.maquinaria.saldo)}
        </div>
        <div className="text-xs text-ink-tertiary">
          {data.maquinaria.cuotasRestantes}{' '}
          {data.maquinaria.cuotasRestantes === 1 ? 'cuota restante' : 'cuotas restantes'} en{' '}
          {data.maquinaria.activas}{' '}
          {data.maquinaria.activas === 1 ? 'máquina' : 'máquinas'}
          {data.maquinaria.pagadas > 0 && ` · ${data.maquinaria.pagadas} ya pagada${data.maquinaria.pagadas === 1 ? '' : 's'}`}
        </div>
      </button>
    </div>
  );
}

function FilaProxima({ row }: { row: ChequeResumenRow }) {
  const d = new Date(row.dueDate);
  return (
    <div className="flex items-center gap-3 border-b border-surface-border py-2">
      <div className="w-11 shrink-0 border-r-2 border-surface-border pr-2">
        <div className="text-[10px] uppercase text-ink-tertiary">{MES_CORTO[d.getMonth()]}</div>
        <div className="text-[19px] font-bold leading-none">{d.getDate()}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink-primary">
          {row.beneficiary || 'Sin beneficiario'}
        </div>
        <div className="truncate text-[11px] text-ink-tertiary">
          {row.chequera ?? '—'}
          {row.number ? ` · #${row.number}` : ''}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[15px] font-bold">{formatCurrency(row.amount)}</div>
        <div className="text-[10px] uppercase text-ink-tertiary">
          {row.dias === 0 ? 'hoy' : `en ${row.dias}d`}
        </div>
      </div>
    </div>
  );
}
