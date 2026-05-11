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

export function CreatePaymentOrderModal({ open, onClose, projectId, rubros, onCreated }: Props) {
  const [rubroId, setRubroId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [description, setDescription] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  // Default: 3 días en el futuro
  const defaultDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  })();
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setRubroId('');
    setProviderId('');
    setDescription('');
    setInvoiceNumber('');
    setAmount('');
    setScheduledDate(defaultDate);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rubroId) {
      setError('Selecciona un rubro');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/payment-orders', {
        projectId,
        rubroId,
        providerId: providerId || undefined,
        description,
        invoiceNumber: invoiceNumber || undefined,
        amount: Number(amount),
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
        <Field label="Rubro" required>
          <select
            value={rubroId}
            onChange={(e) => setRubroId(e.target.value)}
            required
            className="input"
          >
            <option value="">— Selecciona un rubro —</option>
            {rubros.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code}. {r.name} (saldo ${r.balance.toFixed(2)})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Descripción" required>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="input"
            placeholder="Pago semana 3 — cuadrilla pintura"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto" required>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="input"
            />
          </Field>
          <Field label="Fecha programada de pago" required>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
              className="input"
            />
          </Field>
        </div>

        <Field label="Nº de factura">
          <input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="input"
            placeholder="001-001-000123"
          />
        </Field>

        <ProviderSelector value={providerId} onChange={setProviderId} />

        <p className="text-xs text-ink-secondary">
          La orden queda en estado <strong>pendiente</strong> hasta que pulses{' '}
          <em>Marcar como pagado</em>. Al pagarla, se registra automáticamente como gasto del
          rubro.
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
