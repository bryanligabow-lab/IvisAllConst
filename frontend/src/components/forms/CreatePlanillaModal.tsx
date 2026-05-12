'use client';

import { useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { apiPost, ApiClientError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Planilla, RubroSummary } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  rubros: RubroSummary[];
  onCreated: () => void;
}

type Mode = 'QTY' | 'PCT';

interface ItemRow {
  mode: Mode;
  /** What the user typed in the input — interpreted as qty or % based on `mode`. */
  input: string;
  executedQuantity: string;
  currentAmount: string;
  /** True if the user manually edited the monto column (overrides auto-calc). */
  overridden: boolean;
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export function CreatePlanillaModal({ open, onClose, projectId, rubros, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [periodStart, setPeriodStart] = useState(firstOfMonth.toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(today.toISOString().slice(0, 10));
  const [rows, setRows] = useState<Record<string, ItemRow>>(() =>
    Object.fromEntries(
      rubros.map((r) => [
        r.id,
        { mode: 'QTY' as Mode, input: '', executedQuantity: '', currentAmount: '', overridden: false },
      ]),
    ),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setRow(rubroId: string, patch: Partial<ItemRow>) {
    setRows((prev) => ({ ...prev, [rubroId]: { ...prev[rubroId], ...patch } }));
  }

  function recalc(rubroId: string, mode: Mode, input: string) {
    const r = rubros.find((x) => x.id === rubroId);
    if (!r) return;
    const value = Number(input);
    if (!Number.isFinite(value) || value <= 0) {
      setRow(rubroId, { mode, input, executedQuantity: '', currentAmount: '', overridden: false });
      return;
    }
    if (mode === 'QTY') {
      const monto = value * Number(r.unitPrice ?? 0);
      setRow(rubroId, {
        mode,
        input,
        executedQuantity: round2(value),
        currentAmount: round2(monto),
        overridden: false,
      });
    } else {
      const monto = (value / 100) * Number(r.budgetedAmount);
      const qty = (value / 100) * Number(r.quantity ?? 0);
      setRow(rubroId, {
        mode,
        input,
        executedQuantity: round2(qty),
        currentAmount: round2(monto),
        overridden: false,
      });
    }
  }

  function switchMode(rubroId: string, mode: Mode) {
    // Reset input when switching mode to avoid confusion.
    setRow(rubroId, { mode, input: '', executedQuantity: '', currentAmount: '', overridden: false });
  }

  function manualOverride(rubroId: string, currentAmount: string) {
    setRow(rubroId, { currentAmount, overridden: true });
  }

  const total = Object.values(rows).reduce(
    (acc, r) => acc + (Number(r.currentAmount) || 0),
    0,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = Object.entries(rows)
      .filter(([, r]) => Number(r.currentAmount) > 0)
      .map(([rubroId, r]) => ({
        rubroId,
        executedQuantity: Number(r.executedQuantity) || 0,
        currentAmount: Number(r.currentAmount),
      }));

    if (items.length === 0) {
      setError('Agrega al menos un rubro con monto ejecutado');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiPost<Planilla>('/planillas', {
        projectId,
        title,
        periodStart,
        periodEnd,
        items,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al crear la planilla');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva planilla de avance" width="lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Título" required>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="input"
            placeholder="Planilla 01 — Octubre 2026"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Período desde" required>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
              className="input"
            />
          </Field>
          <Field label="Período hasta" required>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              required
              className="input"
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 text-xs text-ink-secondary">
            Avance por rubro · elige <strong>Cantidad</strong> (unidades ejecutadas) o{' '}
            <strong>%</strong> (porcentaje del rubro) — el monto se calcula automáticamente.
          </div>
          <div className="overflow-x-auto rounded-md border border-surface-border">
            <table className="table-default">
              <thead>
                <tr>
                  <th>Rubro</th>
                  <th className="text-right">Presupuestado</th>
                  <th className="w-40">Avance</th>
                  <th className="w-32 text-right">Monto ejecutado</th>
                </tr>
              </thead>
              <tbody>
                {rubros.map((r) => {
                  const row = rows[r.id];
                  const mode = row?.mode ?? 'QTY';
                  const contractedQty = Number(r.quantity ?? 0);
                  const unitPrice = Number(r.unitPrice ?? 0);
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="font-medium">
                        {r.code}. {r.name}
                        {(r.unit || contractedQty > 0 || unitPrice > 0) && (
                          <div className="mt-0.5 text-[11px] text-ink-secondary">
                            {contractedQty > 0 && r.unit
                              ? `${contractedQty} ${r.unit}`
                              : contractedQty > 0
                                ? `${contractedQty} u.`
                                : ''}
                            {unitPrice > 0 && r.unit
                              ? ` · ${formatCurrency(unitPrice)}/${r.unit}`
                              : unitPrice > 0
                                ? ` · ${formatCurrency(unitPrice)} c/u`
                                : ''}
                          </div>
                        )}
                      </td>
                      <td className="text-right">{formatCurrency(r.budgetedAmount)}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={mode}
                            onChange={(e) =>
                              switchMode(r.id, e.target.value as Mode)
                            }
                            className="input !py-1 w-[88px] text-xs"
                            title="Tipo de avance"
                          >
                            <option value="QTY">Cantidad</option>
                            <option value="PCT">%</option>
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={mode === 'PCT' ? 100 : undefined}
                            value={row?.input ?? ''}
                            onChange={(e) => recalc(r.id, mode, e.target.value)}
                            placeholder={mode === 'QTY' ? (r.unit || '0') : '0%'}
                            className="input w-20"
                          />
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row?.currentAmount ?? ''}
                          onChange={(e) => manualOverride(r.id, e.target.value)}
                          className="input w-32 text-right"
                          title="Calculado automáticamente, puedes editarlo manualmente"
                        />
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-ink-primary font-medium">
                  <td colSpan={3} className="text-right">Total planilla</td>
                  <td className="text-right">{formatCurrency(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'Creando…' : 'Crear planilla'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
