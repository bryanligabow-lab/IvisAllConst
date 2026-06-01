'use client';

import { useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { ProviderSelector } from '@/components/forms/ProviderSelector';
import { apiPost, ApiClientError } from '@/lib/api';
import type { RubroSummary } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  rubros: RubroSummary[];
  onCreated: () => void;
}

interface Line {
  rubroId: string;
  amount: string;
}

export function CreatePaymentOrderModal({ open, onClose, projectId, rubros, onCreated }: Props) {
  const [providerId, setProviderId] = useState('');
  const [description, setDescription] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  // Una factura puede repartirse entre varios rubros (desglose).
  const [lines, setLines] = useState<Line[]>([{ rubroId: '', amount: '' }]);
  // Default: 3 días en el futuro
  const defaultDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  })();
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  function reset() {
    setProviderId('');
    setDescription('');
    setInvoiceNumber('');
    setLines([{ rubroId: '', amount: '' }]);
    setScheduledDate(defaultDate);
    setError(null);
  }

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { rubroId: '', amount: '' }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!providerId) {
      setError('Debes seleccionar un proveedor antes de crear la orden');
      return;
    }
    const cleanLines = lines
      .map((l) => ({ rubroId: l.rubroId, amount: Number(l.amount) }))
      .filter((l) => l.rubroId && l.amount > 0);
    if (cleanLines.length === 0) {
      setError('Indica al menos un rubro con su monto');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/payment-orders', {
        projectId,
        providerId,
        description,
        invoiceNumber: invoiceNumber || undefined,
        // Siempre enviamos el desglose; el backend resuelve 1 o varios rubros.
        items: cleanLines,
        scheduledDate,
      });
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al crear la orden de pago');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Crear orden de pago">
      <form onSubmit={handleSubmit} className="space-y-3">
        <ProviderSelector value={providerId} onChange={setProviderId} required />

        <Field label="Descripción" required>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="input"
            placeholder="Compra Ferrisariato — materiales varios"
          />
        </Field>

        <Field label="Nº de factura">
          <input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="input"
            placeholder="001-001-000123"
          />
        </Field>

        {/* Desglose de la factura por rubro */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-ink-secondary">
              Rubros de la factura <span className="text-danger">*</span>
            </label>
            <span className="text-xs text-ink-secondary">
              Total: <span className="font-semibold text-ink-primary">${total.toFixed(2)}</span>
            </span>
          </div>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <select
                    value={line.rubroId}
                    onChange={(e) => updateLine(idx, { rubroId: e.target.value })}
                    className="input"
                  >
                    <option value="">— Selecciona un rubro —</option>
                    {rubros.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code}. {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={line.amount}
                    onChange={(e) => updateLine(idx, { amount: e.target.value })}
                    className="input"
                    placeholder="Monto"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  disabled={lines.length === 1}
                  className="mb-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-secondary hover:bg-danger-soft hover:text-danger disabled:opacity-30"
                  title="Quitar rubro"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addLine}
            className="mt-2 text-xs font-medium text-brand hover:underline"
          >
            + Desglosar en otro rubro
          </button>
        </div>

        <Field label="Fecha programada de pago" required>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            required
            className="input"
          />
        </Field>

        <p className="text-xs text-ink-secondary">
          La orden queda en estado <strong>pendiente</strong>. El <strong>método de pago</strong> se
          elige al momento de aprobarla/pagarla. Si la factura cubre varios rubros, reparte el monto
          en cada uno.
        </p>

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'Guardando…' : 'Crear orden'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
