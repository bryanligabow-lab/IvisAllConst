'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { apiPatch, apiPost } from '@/lib/api';
import type { Ingreso, IngresoKind, Planilla } from '@/types';

const KIND_OPTIONS: Array<{ value: IngresoKind; label: string; hint: string }> = [
  { value: 'ANTICIPO', label: 'Anticipo', hint: 'Adelanto del contrato (p. ej. el 40%)' },
  { value: 'PLANILLA', label: 'Pago de planilla', hint: 'Cobro de una planilla presentada' },
  { value: 'OTRO', label: 'Otro ingreso', hint: 'Cualquier otro cobro del proyecto' },
];

interface CreateIngresoModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  planillas: Planilla[];
  initial?: Ingreso | null;
  onSaved: () => void;
}

export function CreateIngresoModal({
  open,
  onClose,
  projectId,
  planillas,
  initial,
  onSaved,
}: CreateIngresoModalProps) {
  const [kind, setKind] = useState<IngresoKind>('PLANILLA');
  const [amount, setAmount] = useState('');
  const [ingresoDate, setIngresoDate] = useState(new Date().toISOString().slice(0, 10));
  const [planillaId, setPlanillaId] = useState('');
  const [entity, setEntity] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setKind(initial.kind);
      setAmount(String(initial.amount));
      setIngresoDate(initial.ingresoDate ? initial.ingresoDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setPlanillaId(initial.planillaId ?? '');
      setEntity(initial.entity ?? '');
      setInvoiceNumber(initial.invoiceNumber ?? '');
      setReference(initial.reference ?? '');
      setNotes(initial.notes ?? '');
    } else {
      setKind('PLANILLA');
      setAmount('');
      setIngresoDate(new Date().toISOString().slice(0, 10));
      setPlanillaId('');
      setEntity('');
      setInvoiceNumber('');
      setReference('');
      setNotes('');
    }
    setError(null);
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        kind,
        amount: Number(amount),
        ingresoDate,
        planillaId: kind === 'PLANILLA' && planillaId ? planillaId : null,
        entity: entity.trim() || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (initial) {
        await apiPatch(`/ingresos/${initial.id}`, payload);
      } else {
        await apiPost('/ingresos', { projectId, ...payload });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Editar ingreso' : 'Registrar ingreso de dinero'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Tipo de ingreso" required>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {KIND_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-md border px-3 py-2 text-center text-xs transition-colors ${
                  kind === opt.value
                    ? 'border-brand bg-brand/5 font-medium text-ink-primary'
                    : 'border-surface-border text-ink-secondary hover:bg-surface-muted'
                }`}
                title={opt.hint}
              >
                <input
                  type="radio"
                  name="ingreso-kind"
                  value={opt.value}
                  checked={kind === opt.value}
                  onChange={() => setKind(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </Field>

        {kind === 'PLANILLA' && planillas.length > 0 && (
          <Field label="Planilla" hint="A qué planilla corresponde este pago">
            <select
              value={planillaId}
              onChange={(e) => setPlanillaId(e.target.value)}
              className="input w-full"
            >
              <option value="">— Sin planilla específica —</option>
              {planillas.map((p) => (
                <option key={p.id} value={p.id}>
                  Planilla #{p.number} — {p.title}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Monto (USD)" required>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input w-full"
              placeholder="0.00"
            />
          </Field>
          <Field label="Fecha del ingreso" required>
            <input
              type="date"
              required
              value={ingresoDate}
              onChange={(e) => setIngresoDate(e.target.value)}
              className="input w-full"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quién paga" hint="Si se deja vacío, se usa el cliente del proyecto">
            <input
              type="text"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              maxLength={200}
              className="input w-full"
              placeholder="AMBIENSA S.A."
            />
          </Field>
          <Field label="N.º de factura">
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              maxLength={80}
              className="input w-full"
              placeholder="001-001-000000123"
            />
          </Field>
        </div>

        <Field label="Referencia">
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={300}
            className="input w-full"
            placeholder="N.º de transferencia, contrato…"
          />
        </Field>

        <Field label="Notas">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={2}
            className="input w-full"
          />
        </Field>

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Registrar ingreso'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
