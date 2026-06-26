'use client';

import { useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { ProviderSelector } from '@/components/forms/ProviderSelector';
import { InvoiceUpload, type InvoiceFile } from '@/components/forms/InvoiceUpload';
import { apiPost, ApiClientError } from '@/lib/api';
import type { Gasto, RubroSummary } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  rubros: RubroSummary[];
  onCreated: () => void;
}

export function CreateGastoModal({ open, onClose, projectId, rubros, onCreated }: Props) {
  const [rubroId, setRubroId] = useState('');
  // Tipo de gasto: a un proveedor (materiales) o a un subcontratista (anticipo/mano de obra).
  const [tipo, setTipo] = useState<'PROVEEDOR' | 'SUBCONTRATISTA'>('PROVEEDOR');
  const [providerId, setProviderId] = useState('');
  const [description, setDescription] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [gastoDate, setGastoDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoice, setInvoice] = useState<InvoiceFile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setRubroId('');
    setTipo('PROVEEDOR');
    setProviderId('');
    setDescription('');
    setInvoiceNumber('');
    setAmount('');
    setGastoDate(new Date().toISOString().slice(0, 10));
    setInvoice(null);
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
      await apiPost<Gasto>('/gastos', {
        projectId,
        rubroId,
        providerId: providerId || undefined,
        description,
        invoiceNumber: invoiceNumber || undefined,
        amount: Number(amount),
        gastoDate,
        kind: tipo === 'SUBCONTRATISTA' ? 'SUBCONTRACTOR' : 'EXPENSE',
        invoiceBase64: invoice?.base64,
        invoiceMime: invoice?.mime,
      });
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al registrar el gasto');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar gasto">
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
            placeholder="Cemento Holcim 50kg x 40 sacos"
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
          <Field label="Fecha" required>
            <input
              type="date"
              value={gastoDate}
              onChange={(e) => setGastoDate(e.target.value)}
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

        <Field label="Tipo de gasto">
          <div className="flex gap-2">
            {(['PROVEEDOR', 'SUBCONTRATISTA'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTipo(t);
                  setProviderId('');
                }}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                  tipo === t
                    ? 'border-brand bg-brand-light font-medium text-brand'
                    : 'border-surface-border text-ink-secondary hover:bg-surface-muted'
                }`}
              >
                {t === 'PROVEEDOR' ? '🏢 Proveedor' : '👷 Subcontratista'}
              </button>
            ))}
          </div>
        </Field>

        <ProviderSelector
          value={providerId}
          onChange={setProviderId}
          subcontractor={tipo === 'SUBCONTRATISTA'}
        />

        <InvoiceUpload value={invoice} onChange={setInvoice} onError={setError} />

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'Guardando…' : 'Registrar gasto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
