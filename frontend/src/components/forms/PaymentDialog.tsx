'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { apiPost, ApiClientError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { PAYMENT_METHODS } from '@/lib/constants';
import type { PaymentMethodValue, PaymentOrder } from '@/types';

type Mode = 'CHOICE' | 'PARTIAL';

interface Props {
  open: boolean;
  onClose: () => void;
  order: PaymentOrder | null;
  onPaid: () => void;
}

export function PaymentDialog({ open, onClose, order, onPaid }: Props) {
  const [mode, setMode] = useState<Mode>('CHOICE');
  const [partialAmount, setPartialAmount] = useState('');
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState<PaymentMethodValue | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode('CHOICE');
    setPartialAmount('');
    setReference('');
    setMethod((order?.paymentMethod as PaymentMethodValue | undefined) ?? '');
    setError(null);
  }, [open, order?.id, order?.paymentMethod]);

  if (!order) return null;

  const pending = Number(order.pendingAmount ?? order.amount);

  async function pay(payload: { mode: 'TOTAL' | 'PARTIAL'; amount?: number; reference?: string }) {
    if (!order) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/payment-orders/${order.id}/pay`, {
        ...payload,
        ...(method ? { paymentMethod: method } : {}),
      });
      onPaid();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo procesar el pago');
    } finally {
      setSubmitting(false);
    }
  }

  function handlePartialSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(partialAmount);
    if (!amt || amt <= 0) {
      setError('Indica un monto válido');
      return;
    }
    if (amt > pending + 0.0001) {
      setError(`El monto no puede ser mayor al saldo pendiente (${formatCurrency(pending, true)})`);
      return;
    }
    pay({ mode: 'PARTIAL', amount: amt, reference: reference || undefined });
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar pago">
      <div className="space-y-4">
        <div className="rounded-md bg-surface-muted px-3 py-2 text-xs">
          <div className="font-medium text-ink-primary">{order.description}</div>
          {order.rubro && (
            <div className="text-ink-secondary">
              Rubro {order.rubro.code}. {order.rubro.name}
            </div>
          )}
          <div className="mt-2 flex justify-between">
            <span className="text-ink-secondary">Monto total</span>
            <span className="font-medium">{formatCurrency(Number(order.amount), true)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-secondary">Pagado hasta ahora</span>
            <span>{formatCurrency(Number(order.paidAmount ?? 0), true)}</span>
          </div>
          <div className="flex justify-between border-t border-surface-border pt-1 mt-1">
            <span className="text-ink-secondary">Saldo pendiente</span>
            <span className="font-medium text-danger">{formatCurrency(pending, true)}</span>
          </div>
        </div>

        {order.items && order.items.length > 1 && (
          <div className="rounded-md border border-surface-border px-3 py-2 text-xs">
            <div className="mb-1 font-medium text-ink-primary">Desglose por rubro</div>
            <ul className="space-y-0.5">
              {order.items.map((it) => (
                <li key={it.id} className="flex justify-between">
                  <span className="text-ink-secondary">
                    {it.rubro.code}. {it.rubro.name}
                  </span>
                  <span>{formatCurrency(Number(it.amount), true)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Field label="Método de pago">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethodValue | '')}
            className="input"
          >
            <option value="">— Selecciona un método —</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.icon} {m.label}
              </option>
            ))}
          </select>
        </Field>

        {mode === 'CHOICE' && (
          <>
            <p className="text-sm">¿Cómo quieres registrar el pago?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => pay({ mode: 'TOTAL' })}
                className="group rounded-lg border-2 border-success bg-success-soft px-4 py-5 text-left transition-all hover:shadow-md disabled:opacity-50"
              >
                <div className="text-2xl">💰</div>
                <div className="mt-1 text-sm font-medium text-success">Pago total</div>
                <div className="mt-1 text-xs text-ink-secondary">
                  Paga el saldo completo ({formatCurrency(pending, true)}) y cierra la orden.
                </div>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setMode('PARTIAL')}
                className="group rounded-lg border-2 border-brand bg-brand-light px-4 py-5 text-left transition-all hover:shadow-md disabled:opacity-50"
              >
                <div className="text-2xl">📋</div>
                <div className="mt-1 text-sm font-medium text-brand">Pago parcial</div>
                <div className="mt-1 text-xs text-ink-secondary">
                  Anticipo o abono. La orden queda pendiente con el saldo actualizado.
                </div>
              </button>
            </div>
            {submitting && <div className="text-xs text-ink-secondary">Procesando…</div>}
          </>
        )}

        {mode === 'PARTIAL' && (
          <form onSubmit={handlePartialSubmit} className="space-y-3">
            <Field label="Monto del anticipo / abono" required>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={pending}
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                required
                autoFocus
                className="input text-lg"
                placeholder={`Hasta ${pending.toFixed(2)}`}
              />
            </Field>
            <Field label="Referencia (opcional)">
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="input"
                placeholder="Anticipo 1, Abono semana 2…"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMode('CHOICE')}
                className="btn-secondary"
                disabled={submitting}
              >
                ← Atrás
              </button>
              <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
                {submitting ? 'Procesando…' : 'Confirmar pago parcial'}
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
        )}
      </div>
    </Modal>
  );
}
