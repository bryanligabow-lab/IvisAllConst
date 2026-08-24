'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Field } from '@/components/ui/Modal';
import { ProviderSelector } from '@/components/forms/ProviderSelector';
import { apiPost, ApiClientError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { ROUTES } from '@/lib/constants';

interface Props {
  open: boolean;
  onClose: () => void;
  proforma: {
    id: string;
    number: string;
    clientName: string;
    projectLabel?: string | null;
    total: number;
    itemsCount: number;
  } | null;
  onConverted?: () => void;
}

/**
 * Convierte una proforma en proyecto: el proyecto nace con el cliente, el monto
 * del contrato y un rubro por cada ítem, para no volver a escribir todo. En el
 * mismo paso se puede derivar a un subcontratista.
 */
export function ConvertProformaModal({ open, onClose, proforma, onConverted }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [subcontratado, setSubcontratado] = useState(false);
  const [subcontractorId, setSubcontractorId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !proforma) return;
    setName(proforma.projectLabel?.trim() || `Proforma ${proforma.number}`);
    setCity('');
    setSubcontratado(false);
    setSubcontractorId('');
    setError(null);
  }, [open, proforma]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!proforma) return;
    if (subcontratado && !subcontractorId) {
      setError('Elige el subcontratista o desmarca la opción');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = (await apiPost(`/proformas/${proforma.id}/convert`, {
        name: name.trim(),
        city: city.trim() || null,
        executionType: subcontratado ? 'SUBCONTRACTED' : 'OWN',
        subcontractorId: subcontratado ? subcontractorId : null,
      })) as { project: { id: string } };
      onConverted?.();
      onClose();
      router.push(ROUTES.PROJECT_BUDGET(r.project.id));
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'No se pudo convertir la proforma',
      );
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Convertir proforma en proyecto">
      {proforma && (
        <form onSubmit={submit} className="space-y-3">
          <div className="rounded-md bg-surface-muted/50 px-3 py-2 text-xs text-ink-secondary">
            Proforma <strong>{proforma.number}</strong> · {proforma.clientName}
            <br />
            Se creará el proyecto con <strong>{proforma.itemsCount} rubros</strong> y un contrato
            de <strong className="text-brand">{formatCurrency(proforma.total)}</strong>.
          </div>

          <Field label="Nombre del proyecto" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              className="input"
            />
          </Field>

          <Field label="Ciudad (opcional)">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={120}
              className="input"
              placeholder="Ej. Guayaquil"
            />
          </Field>

          <div className="rounded-lg border border-surface-border p-3">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={subcontratado}
                onChange={(e) => setSubcontratado(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[color:var(--color-brand,#C73E2C)]"
              />
              <span>
                <span className="text-sm font-medium text-ink-primary">
                  Derivar a un subcontratista
                </span>
                <span className="block text-[11px] text-ink-tertiary">
                  La obra la ejecuta otra persona o empresa.
                </span>
              </span>
            </label>
            {subcontratado && (
              <div className="mt-2">
                <ProviderSelector
                  value={subcontractorId}
                  onChange={setSubcontractorId}
                  label="Subcontratista"
                  subcontractor
                />
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Creando…' : 'Crear proyecto'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
