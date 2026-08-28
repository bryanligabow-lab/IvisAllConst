'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiGet } from '@/lib/api';
import type { ChequeGroupAvisos } from '@/types';

interface Props {
  value: ChequeGroupAvisos;
  onChange: (v: ChequeGroupAvisos) => void;
}

const OPCIONES: { key: keyof ChequeGroupAvisos; label: string; hint: string }[] = [
  { key: 'notifyWeekly', label: 'Una vez por semana', hint: 'Lunes 7:00 a. m.' },
  { key: 'notifyMonthly', label: 'Una vez al mes', hint: 'El 1º del mes' },
  { key: 'notifyDayBefore', label: 'Un día antes del cobro', hint: '7:00 a. m.' },
  { key: 'notifyOnDue', label: 'El día del cobro', hint: '7:00 a. m.' },
];

/**
 * A quiénes avisar de este financiamiento y cada cuándo. Los correos se
 * guardan con el financiamiento, así no hay que reescribirlos cada vez.
 */
export function AvisosField({ value, onChange }: Props) {
  const [texto, setTexto] = useState('');
  // Los correos "de siempre" (los de Cuentas → Correos), para no teclearlos.
  const { data: guardados } = useSWR<{ email: string; name: string | null }[]>(
    '/notifications/recipients?scope=CHEQUES',
    apiGet,
  );

  const set = (parcial: Partial<ChequeGroupAvisos>) => onChange({ ...value, ...parcial });

  function agregar(raw: string) {
    const nuevos = raw
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@') && !value.notifyEmails.includes(e));
    if (nuevos.length > 0) set({ notifyEmails: [...value.notifyEmails, ...nuevos] });
    setTexto('');
  }

  const sugeridos = (guardados ?? [])
    .map((g) => g.email)
    .filter((e) => !value.notifyEmails.includes(e));

  return (
    <div className="rounded-lg border border-surface-border bg-surface-muted/30 p-3">
      <div className="mb-2 text-xs font-semibold text-ink-secondary">Avisos por correo</div>

      {/* Correos */}
      <div className="flex flex-wrap gap-1.5">
        {value.notifyEmails.map((e) => (
          <span
            key={e}
            className="flex items-center gap-1 rounded-full border border-surface-border bg-surface px-2 py-1 text-[11px]"
          >
            {e}
            <button
              type="button"
              onClick={() => set({ notifyEmails: value.notifyEmails.filter((x) => x !== e) })}
              className="text-ink-tertiary hover:text-danger"
              title="Quitar"
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={texto}
          onChange={(ev) => setTexto(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' || ev.key === ',') {
              ev.preventDefault();
              agregar(texto);
            }
          }}
          onBlur={() => texto.trim() && agregar(texto)}
          className="input h-9 flex-1 text-xs"
          placeholder="correo@ejemplo.com y Enter"
        />
      </div>

      {sugeridos.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-tertiary">
          <span>Usar los de siempre:</span>
          {sugeridos.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => set({ notifyEmails: [...value.notifyEmails, e] })}
              className="rounded-full border border-dashed border-surface-border px-2 py-0.5 hover:border-brand hover:text-brand"
            >
              + {e}
            </button>
          ))}
        </div>
      )}

      {/* Cuándo */}
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {OPCIONES.map((o) => (
          <label key={o.key} className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={Boolean(value[o.key])}
              onChange={(ev) => set({ [o.key]: ev.target.checked } as Partial<ChequeGroupAvisos>)}
              className="mt-0.5"
            />
            <span>
              {o.label}
              <span className="block text-[10px] text-ink-tertiary">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink-tertiary">
        Si no pones correos aquí, los avisos igual salen a la lista general de Cuentas → Correos.
      </p>
    </div>
  );
}

export const AVISOS_POR_DEFECTO: ChequeGroupAvisos = {
  notifyEmails: [],
  notifyWeekly: false,
  notifyMonthly: false,
  notifyDayBefore: true,
  notifyOnDue: true,
};
