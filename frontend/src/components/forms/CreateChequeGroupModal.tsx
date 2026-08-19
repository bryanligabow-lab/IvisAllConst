'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { apiPost, ApiClientError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (id?: string) => void;
  bancos?: string[];
}

// Crea un financiamiento de maquinaria y genera sus cuotas mensuales de una vez.
export function CreateChequeGroupModal({ open, onClose, onSaved, bancos = [] }: Props) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [count, setCount] = useState('12');
  const [amount, setAmount] = useState('');
  const [firstDate, setFirstDate] = useState('');
  const [firstNumber, setFirstNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setSource('');
    setCount('12');
    setAmount('');
    setFirstDate('');
    setFirstNumber('');
    setError(null);
  }, [open]);

  const n = Number(count) || 0;
  const amt = Number(amount) || 0;
  const totalPreview = n * amt;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Ponle un nombre a la maquinaria');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        source: source.trim() || null,
        generate:
          n > 0 && amt > 0 && firstDate
            ? {
                count: n,
                amount: amt,
                firstDate,
                firstNumber: firstNumber ? Number(firstNumber) : null,
              }
            : null,
      };
      const created = (await apiPost('/cheques/groups', payload)) as { id: string };
      onSaved(created.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo crear');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo financiamiento (maquinaria)">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Maquinaria / nombre" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            className="input"
            placeholder="Ej. MIXER 3, VOLQUETA"
          />
        </Field>
        <Field label="Banco / fuente que paga">
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            list="grp-bancos"
            maxLength={120}
            className="input"
            placeholder="Ej. CREACOM GUAYAQUIL"
          />
          <datalist id="grp-bancos">
            {bancos.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>

        <div className="rounded-lg border border-surface-border bg-surface-muted/30 p-3">
          <div className="mb-2 text-xs font-semibold text-ink-secondary">
            Generar cuotas mensuales
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <Field label="Nº 1er cheque" hint="Opcional; se numera solo.">
              <input
                type="number"
                inputMode="numeric"
                value={firstNumber}
                onChange={(e) => setFirstNumber(e.target.value)}
                className="input"
              />
            </Field>
          </div>
          {totalPreview > 0 && (
            <div className="mt-2 text-xs text-ink-secondary">
              Se crearán <strong>{n}</strong> cheques mensuales · Total{' '}
              <strong className="text-brand">{formatCurrency(totalPreview)}</strong>
            </div>
          )}
        </div>

        {error && <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
