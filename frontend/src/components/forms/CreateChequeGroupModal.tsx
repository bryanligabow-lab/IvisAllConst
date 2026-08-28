'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { apiPost, ApiClientError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { AvisosField, AVISOS_POR_DEFECTO } from '@/components/cheques/AvisosField';
import type { Chequera, ChequeGroupAvisos } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (id?: string) => void;
  chequeras?: Chequera[];
}

interface Cuota {
  number: string;
  dueDate: string;
  amount: string;
}

/** Suma meses conservando el día (si el mes no lo tiene, cae al último día). */
function sumarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(d, ultimo));
  return base.toISOString().slice(0, 10);
}

/**
 * Nuevo financiamiento: se generan las cuotas de una vez y quedan visibles
 * para ajustar, una por una, el nº de cheque, la fecha de cobro y el monto
 * (una cuota puede caer distinto o tener otro valor).
 */
export function CreateChequeGroupModal({ open, onClose, onSaved, chequeras = [] }: Props) {
  const [name, setName] = useState('');
  const [chequeraId, setChequeraId] = useState('');
  const [count, setCount] = useState('12');
  const [amount, setAmount] = useState('');
  const [firstDate, setFirstDate] = useState('');
  const [firstNumber, setFirstNumber] = useState('');
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [avisos, setAvisos] = useState<ChequeGroupAvisos>(AVISOS_POR_DEFECTO);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setChequeraId('');
    setCount('12');
    setAmount('');
    setFirstDate('');
    setFirstNumber('');
    setCuotas([]);
    setAvisos(AVISOS_POR_DEFECTO);
    setError(null);
  }, [open]);

  // Sugerir el próximo folio de la chequera elegida.
  useEffect(() => {
    const q = chequeras.find((c) => c.id === chequeraId);
    if (q?.proximoFolio && !firstNumber) setFirstNumber(String(q.proximoFolio));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chequeraId]);

  function generar() {
    const n = Number(count) || 0;
    const monto = Number(amount) || 0;
    if (n < 1) return setError('Pon cuántas cuotas son');
    if (!firstDate) return setError('Pon la fecha de la primera cuota');
    const base = firstNumber ? Number(firstNumber) : null;
    setCuotas(
      Array.from({ length: n }, (_, i) => ({
        number: base != null ? String(base + i) : '',
        dueDate: sumarMeses(firstDate, i),
        amount: monto ? String(monto) : '',
      })),
    );
    setError(null);
  }

  const editar = (i: number, campo: keyof Cuota, valor: string) =>
    setCuotas((prev) => prev.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)));

  const total = cuotas.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Ponle un nombre al financiamiento');
    if (cuotas.length === 0) return setError('Genera las cuotas primero');
    if (cuotas.some((c) => !c.dueDate)) return setError('Todas las cuotas necesitan fecha de cobro');
    setSaving(true);
    setError(null);
    try {
      const chequera = chequeras.find((c) => c.id === chequeraId);
      const created = (await apiPost('/cheques/groups', {
        name: name.trim(),
        chequeraId: chequeraId || null,
        source: chequera?.corto ?? null,
        ...avisos,
        cuotas: cuotas.map((c) => ({
          number: c.number.trim() || null,
          dueDate: c.dueDate,
          amount: Number(c.amount) || 0,
        })),
      })) as { id: string };
      onSaved(created.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo crear');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo financiamiento" width="lg">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nombre" required hint="Maquinaria, proveedor o lo que se esté financiando.">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            className="input"
            placeholder="Ej. MIXER 1, VOLQUETA, Proveedor X"
          />
        </Field>

        <Field label="Chequera" hint="De qué libreta salen los cheques.">
          <select
            value={chequeraId}
            onChange={(e) => setChequeraId(e.target.value)}
            className="input"
          >
            <option value="">— Elegir chequera —</option>
            {chequeras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.corto}
                {c.proximoFolio ? ` (próx. #${c.proximoFolio})` : ''}
              </option>
            ))}
          </select>
        </Field>

        {/* Generador */}
        <div className="rounded-lg border border-surface-border bg-surface-muted/30 p-3">
          <div className="mb-2 text-xs font-semibold text-ink-secondary">Generar las cuotas</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Nº de cuotas">
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="120"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Monto por cuota">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input"
                placeholder="0.00"
              />
            </Field>
            <Field label="Fecha 1ª cuota">
              <input
                type="date"
                value={firstDate}
                onChange={(e) => setFirstDate(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Nº 1er cheque">
              <input
                type="number"
                inputMode="numeric"
                value={firstNumber}
                onChange={(e) => setFirstNumber(e.target.value)}
                className="input"
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={generar}
            className="btn-secondary mt-1 w-full text-xs"
          >
            {cuotas.length > 0 ? '↻ Volver a generar' : '↓ Generar cuotas'}
          </button>
          <p className="mt-1 text-[11px] text-ink-tertiary">
            Se crean mensuales desde esa fecha y numeradas en orden. Después puedes cambiar cada
            una.
          </p>
        </div>

        {/* Cuotas editables */}
        {cuotas.length > 0 && (
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <div className="text-xs font-semibold text-ink-secondary">
                {cuotas.length} cheques · revisa cada uno
              </div>
              <div className="text-xs">
                Total <span className="font-bold text-brand">{formatCurrency(total)}</span>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border border-surface-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-surface-border text-ink-secondary">
                    <th className="w-8 px-1 py-1.5 text-left font-medium">#</th>
                    <th className="px-1 py-1.5 text-left font-medium">Nº cheque</th>
                    <th className="px-1 py-1.5 text-left font-medium">Se cobra</th>
                    <th className="px-1 py-1.5 text-right font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {cuotas.map((c, i) => (
                    <tr key={i} className="border-b border-surface-border last:border-b-0">
                      <td className="px-1 py-1 text-ink-tertiary">{i + 1}</td>
                      <td className="px-1 py-1">
                        <input
                          value={c.number}
                          onChange={(e) => editar(i, 'number', e.target.value)}
                          className="input h-8 w-full text-xs"
                          placeholder="—"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="date"
                          value={c.dueDate}
                          onChange={(e) => editar(i, 'dueDate', e.target.value)}
                          className="input h-8 w-full text-xs"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={c.amount}
                          onChange={(e) => editar(i, 'amount', e.target.value)}
                          className="input h-8 w-full text-right text-xs"
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <AvisosField value={avisos} onChange={setAvisos} />

        {error && <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Creando…' : `Crear ${cuotas.length || ''} cheques`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
