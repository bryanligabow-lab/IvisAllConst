'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { apiPost, apiPatch, ApiClientError } from '@/lib/api';
import type { Cheque, ChequeStatus } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Cheque | null;
  bancos?: string[];
}

const STATUS_OPTIONS: { value: ChequeStatus; label: string }[] = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'COBRADO', label: 'Cobrado' },
  { value: 'ANULADO', label: 'Anulado' },
];

export function CreateChequeModal({ open, onClose, onSaved, initial, bancos = [] }: Props) {
  const isEdit = !!initial;
  const [number, setNumber] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [bank, setBank] = useState('');
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<ChequeStatus>('PENDIENTE');
  const [cashDate, setCashDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNumber(initial?.number ?? '');
    setBeneficiary(initial?.beneficiary ?? '');
    setBank(initial?.bank ?? '');
    setAmount(initial ? String(initial.amount) : '');
    setIssueDate(initial?.issueDate ? initial.issueDate.slice(0, 10) : '');
    setDueDate(initial?.dueDate ? initial.dueDate.slice(0, 10) : '');
    setStatus(initial?.status ?? 'PENDIENTE');
    setCashDate(initial?.cashDate ? initial.cashDate.slice(0, 10) : '');
    setNotes(initial?.notes ?? '');
    setError(null);
  }, [open, initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        number: number.trim(),
        beneficiary: beneficiary.trim() || null,
        bank: bank.trim() || null,
        amount: Number(amount) || 0,
        issueDate: issueDate || null,
        dueDate: dueDate || issueDate || null,
        status,
        cashDate: status === 'COBRADO' ? cashDate || dueDate || issueDate || null : null,
        notes: notes.trim() || null,
      };
      if (isEdit && initial) await apiPatch(`/cheques/${initial.id}`, payload);
      else await apiPost('/cheques', payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo guardar el cheque');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar cheque' : 'Nuevo cheque'}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nº de cheque">
            <input value={number} onChange={(e) => setNumber(e.target.value)} maxLength={40} className="input" />
          </Field>
          <Field label="Monto" required>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="input"
              placeholder="0.00"
            />
          </Field>
        </div>
        <Field label="Beneficiario">
          <input
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            maxLength={200}
            className="input"
            placeholder="A quién / concepto"
          />
        </Field>
        <Field label="Banco / cuenta">
          <input
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            list="bancos-list"
            maxLength={120}
            className="input"
            placeholder="Ej. CREACOM GUAYAQUIL"
          />
          <datalist id="bancos-list">
            {bancos.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha de emisión">
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="input" />
          </Field>
          <Field
            label="Se cobra el"
            hint="Postfechado: la fecha en que se va a cobrar. Es la que sale en el calendario."
          >
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value as ChequeStatus)} className="input">
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        {status === 'COBRADO' && (
          <Field label="Fecha en que se cobró" hint="Si la dejas vacía, se usa la de emisión.">
            <input type="date" value={cashDate} onChange={(e) => setCashDate(e.target.value)} className="input" />
          </Field>
        )}
        <Field label="Observaciones">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="input" />
        </Field>

        {error && <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Agregar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
