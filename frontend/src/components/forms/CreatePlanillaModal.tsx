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

interface ItemRow {
  executedQuantity: string;
  currentAmount: string;
}

export function CreatePlanillaModal({ open, onClose, projectId, rubros, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [periodStart, setPeriodStart] = useState(firstOfMonth.toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(today.toISOString().slice(0, 10));
  const [rows, setRows] = useState<Record<string, ItemRow>>(() =>
    Object.fromEntries(rubros.map((r) => [r.id, { executedQuantity: '', currentAmount: '' }])),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setRow(rubroId: string, patch: Partial<ItemRow>) {
    setRows((prev) => ({ ...prev, [rubroId]: { ...prev[rubroId], ...patch } }));
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
            Avance por rubro (escribe el monto ejecutado en este período)
          </div>
          <div className="overflow-x-auto rounded-md border border-surface-border">
            <table className="table-default">
              <thead>
                <tr>
                  <th>Rubro</th>
                  <th>Presupuestado</th>
                  <th>Cantidad</th>
                  <th>Monto ejecutado</th>
                </tr>
              </thead>
              <tbody>
                {rubros.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">
                      {r.code}. {r.name}
                    </td>
                    <td>{formatCurrency(r.budgetedAmount)}</td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={rows[r.id]?.executedQuantity ?? ''}
                        onChange={(e) =>
                          setRow(r.id, { executedQuantity: e.target.value })
                        }
                        className="input w-24"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={rows[r.id]?.currentAmount ?? ''}
                        onChange={(e) =>
                          setRow(r.id, { currentAmount: e.target.value })
                        }
                        className="input w-32"
                      />
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-ink-primary font-medium">
                  <td colSpan={3}>Total planilla</td>
                  <td>{formatCurrency(total)}</td>
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
