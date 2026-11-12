'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Modal, Field } from '@/components/ui/Modal';
import { apiDelete, apiGet, apiPost, ApiClientError } from '@/lib/api';
import { formatCurrency, formatCalendarDate } from '@/lib/format';
import type { Employee } from './CreateEmployeeModal';

interface Anticipo {
  id: string;
  amount: number;
  advanceDate: string;
  notes: string | null;
  appliedGastoId: string | null;
  appliedAt: string | null;
}

interface Props {
  employee: Employee | null;
  onClose: () => void;
  canWrite: boolean;
}

/**
 * Anticipos de un empleado: plata entregada a cuenta del sueldo. Los que
 * están pendientes aparecen al registrar el pago para descontarlos del rol.
 */
export function AnticiposModal({ employee, onClose, canWrite }: Props) {
  const key = employee ? `/employees/${employee.id}/advances` : null;
  const { data, mutate } = useSWR<{ advances: Anticipo[]; pendiente: number }>(key, apiGet);

  const [amount, setAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;
    const monto = Number(amount);
    if (!(monto > 0)) {
      setError('Pon un monto mayor que cero');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiPost(`/employees/${employee.id}/advances`, {
        amount: monto,
        advanceDate,
        notes: notes.trim() || undefined,
      });
      setAmount('');
      setNotes('');
      await mutate();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo guardar el anticipo');
    } finally {
      setSaving(false);
    }
  }

  async function quitar(a: Anticipo) {
    setError(null);
    try {
      await apiDelete(`/employees/advances/${a.id}`);
      await mutate();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo eliminar');
    }
  }

  const anticipos = data?.advances ?? [];
  const pendientes = anticipos.filter((a) => !a.appliedGastoId);
  const descontados = anticipos.filter((a) => a.appliedGastoId);

  return (
    <Modal
      open={!!employee}
      onClose={onClose}
      title={`Anticipos — ${employee?.fullName ?? ''}`}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-surface-border bg-surface-muted/40 px-3 py-2">
          <div className="text-xs text-ink-secondary">Pendiente de descontar</div>
          <div className="text-2xl font-bold text-danger">
            {formatCurrency(data?.pendiente ?? 0)}
          </div>
          <p className="mt-1 text-[11px] text-ink-tertiary">
            Al registrar el pago de nómina aparecen para marcarlos y se restan del rol.
          </p>
        </div>

        {canWrite && (
          <form onSubmit={agregar} className="rounded-lg border border-surface-border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Monto entregado ($)" required>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="input"
                  placeholder="0.00"
                />
              </Field>
              <Field label="Fecha">
                <input
                  type="date"
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                  className="input"
                />
              </Field>
            </div>
            <Field label="Detalle (opcional)">
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                className="input"
                placeholder="Ej. adelanto quincena, emergencia médica"
              />
            </Field>
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary text-xs disabled:opacity-50"
              >
                {saving ? 'Guardando…' : '+ Registrar anticipo'}
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
        )}

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
            Pendientes ({pendientes.length})
          </div>
          {pendientes.length === 0 && (
            <div className="rounded-md border border-dashed border-surface-border px-3 py-3 text-center text-xs text-ink-secondary">
              No tiene anticipos pendientes.
            </div>
          )}
          {pendientes.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-2 border-b border-surface-border py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="font-semibold">{formatCurrency(a.amount)}</div>
                <div className="text-[11px] text-ink-tertiary">
                  {formatCalendarDate(a.advanceDate)}
                  {a.notes ? ` · ${a.notes}` : ''}
                </div>
              </div>
              {canWrite && (
                <button
                  onClick={() => void quitar(a)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
                  title="Eliminar este anticipo"
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>

        {descontados.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Ya descontados ({descontados.length})
            </div>
            {descontados.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 border-b border-surface-border py-1.5 text-xs text-ink-tertiary"
              >
                <span>
                  {formatCalendarDate(a.advanceDate)}
                  {a.notes ? ` · ${a.notes}` : ''}
                </span>
                <span className="font-semibold">{formatCurrency(a.amount)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={onClose} className="btn-secondary">
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
