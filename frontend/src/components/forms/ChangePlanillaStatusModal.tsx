'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { apiPatch } from '@/lib/api';
import {
  PLANILLA_STATUS_FLOW,
  PLANILLA_STATUS_LABEL,
} from '@/lib/planillaStatus';
import type { Planilla, PlanillaStatus } from '@/types';

interface ChangePlanillaStatusModalProps {
  open: boolean;
  onClose: () => void;
  planilla: Planilla | null;
  onSaved: () => void;
}

/**
 * Seguimiento del cobro: el residente (o admin) mueve la planilla al paso en
 * que está — presentada, fiscalización, contraloría, aprobada, pagada — y
 * puede dejar una nota ("devuelta por observaciones", etc.).
 */
export function ChangePlanillaStatusModal({
  open,
  onClose,
  planilla,
  onSaved,
}: ChangePlanillaStatusModalProps) {
  const [status, setStatus] = useState<PlanillaStatus>('DRAFT');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && planilla) {
      setStatus(planilla.status);
      setNote('');
      setError(null);
    }
  }, [open, planilla]);

  if (!planilla) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiPatch(`/planillas/${planilla.id}/status`, {
        status,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
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
      title={`¿En qué paso va la Planilla #${planilla.number}?`}
      width="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Estado" required>
          <div className="space-y-1.5">
            {PLANILLA_STATUS_FLOW.map((s, idx) => (
              <label
                key={s}
                className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                  status === s
                    ? 'border-brand bg-brand/5 font-medium text-ink-primary'
                    : 'border-surface-border text-ink-secondary hover:bg-surface-muted'
                }`}
              >
                <input
                  type="radio"
                  name="planilla-status"
                  value={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                  className="accent-brand"
                />
                <span className="text-xs text-ink-tertiary">{idx + 1}.</span>
                {PLANILLA_STATUS_LABEL[s]}
              </label>
            ))}
            <label
              className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                status === 'CANCELLED'
                  ? 'border-danger bg-danger-soft font-medium text-danger'
                  : 'border-surface-border text-ink-secondary hover:bg-surface-muted'
              }`}
            >
              <input
                type="radio"
                name="planilla-status"
                value="CANCELLED"
                checked={status === 'CANCELLED'}
                onChange={() => setStatus('CANCELLED')}
                className="accent-brand"
              />
              <span className="text-xs text-ink-tertiary">✕</span>
              {PLANILLA_STATUS_LABEL.CANCELLED}
            </label>
          </div>
        </Field>

        <Field
          label="Nota (opcional)"
          hint="Ej.: “ingresó a contraloría el lunes”, “devuelta por observaciones”"
        >
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            className="input w-full"
            placeholder="Deja una nota del seguimiento…"
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
            {saving ? 'Guardando…' : 'Actualizar estado'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
