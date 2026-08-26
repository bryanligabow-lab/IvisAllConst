'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiGet, apiFetchBlob } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Chequera } from '@/types';

/**
 * Cuentas: una fila por chequera (empresa + banco), con sus cifras y el
 * próximo número de cheque disponible.
 */
export function CuentasTab({ onVerCheques }: { onVerCheques: (chequeraId: string) => void }) {
  const { data, isLoading } = useSWR<Chequera[]>('/cheques/chequeras', apiGet);
  const [bajando, setBajando] = useState(false);

  // Libro de cheques en Excel: una hoja por chequera.
  async function descargarExcel() {
    setBajando(true);
    try {
      const blob = await apiFetchBlob('/cheques/export');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Cheques CREACOM ${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBajando(false);
    }
  }

  if (isLoading) return <div className="py-6 text-sm text-ink-secondary">Cargando…</div>;

  const libretas = (data ?? []).filter((c) => c.emitidos > 0 || c.id !== 'sin-asignar');

  return (
    <div>
      <button
        onClick={descargarExcel}
        disabled={bajando}
        className="mb-3 w-full border-2 border-surface-border py-2.5 text-xs font-bold uppercase tracking-[.04em] text-ink-secondary hover:border-brand/60 hover:text-brand disabled:opacity-50"
      >
        {bajando ? 'Generando…' : '⬇ Descargar Excel (una hoja por chequera)'}
      </button>
      {libretas.map((c) => (
        <button
          key={c.id}
          onClick={() => onVerCheques(c.id)}
          className="w-full border-b border-surface-border py-3 text-left"
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0 truncate text-[17px] font-bold">{c.corto}</div>
            <div className="shrink-0 text-[11px] text-ink-tertiary">{c.banco}</div>
          </div>
          <div className="mt-2 grid grid-cols-3 border-t border-surface-border pt-2">
            <Celda label="Emitidos" valor={String(c.emitidos)} />
            <Celda
              label="Pendiente"
              valor={formatCurrency(c.pendiente)}
              tone={c.pendiente > 0 ? 'brand' : undefined}
            />
            <Celda label="Próx. folio" valor={c.proximoFolio ? `#${c.proximoFolio}` : '—'} />
          </div>
        </button>
      ))}
      <p className="mt-3 text-[11px] text-ink-tertiary">
        El próximo folio se calcula del número de cheque más alto usado en esa chequera. Los que
        aparecen en <strong>Sin asignar</strong> son filas del Excel que venían sin banco.
      </p>
    </div>
  );
}

function Celda({
  label,
  valor,
  tone,
}: {
  label: string;
  valor: string;
  tone?: 'brand';
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[.06em] text-ink-tertiary">{label}</div>
      <div className={`text-sm font-bold ${tone === 'brand' ? 'text-brand' : 'text-ink-primary'}`}>
        {valor}
      </div>
    </div>
  );
}
