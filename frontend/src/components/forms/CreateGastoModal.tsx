'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { ProviderSelector } from '@/components/forms/ProviderSelector';
import type { InvoiceFile } from '@/components/forms/InvoiceUpload';
import { GastoDocsField, type ExistingDoc } from '@/components/forms/GastoDocsField';
import { apiPatch, apiPost, ApiClientError } from '@/lib/api';
import type { Gasto, RubroSummary } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  rubros: RubroSummary[];
  initial?: Gasto | null; // si viene → edición
  onCreated: () => void;
}

export function CreateGastoModal({ open, onClose, projectId, rubros, initial, onCreated }: Props) {
  const isEdit = !!initial;
  const [rubroId, setRubroId] = useState('');
  // Tipo de gasto: a un proveedor (materiales) o a un subcontratista (anticipo/mano de obra).
  const [tipo, setTipo] = useState<'PROVEEDOR' | 'SUBCONTRATISTA'>('PROVEEDOR');
  const [providerId, setProviderId] = useState('');
  const [description, setDescription] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [gastoDate, setGastoDate] = useState(new Date().toISOString().slice(0, 10));
  // Documentos nuevos a subir + ids de documentos existentes a quitar.
  const [newDocs, setNewDocs] = useState<InvoiceFile[]>([]);
  const [removedDocIds, setRemovedDocIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Documentos ya guardados (al editar): factura legacy + GastoDocument.
  const existingDocs: ExistingDoc[] = initial
    ? [
        ...(initial.invoiceImageMime
          ? [
              {
                id: 'legacy',
                path: `/gastos/${initial.id}/invoice`,
                mime: initial.invoiceImageMime,
              },
            ]
          : []),
        ...(initial.documents ?? []).map((d) => ({
          id: d.id,
          path: `/gastos/${initial.id}/documents/${d.id}`,
          mime: d.mimeType,
        })),
      ]
    : [];

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setRubroId(initial.rubroId ?? '');
      setTipo(initial.kind === 'SUBCONTRACTOR' ? 'SUBCONTRATISTA' : 'PROVEEDOR');
      setProviderId(initial.providerId ?? '');
      setDescription(initial.description ?? '');
      setInvoiceNumber(initial.invoiceNumber ?? '');
      setAmount(String(initial.amount ?? ''));
      setGastoDate(initial.gastoDate ? initial.gastoDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    } else {
      setRubroId('');
      setTipo('PROVEEDOR');
      setProviderId('');
      setDescription('');
      setInvoiceNumber('');
      setAmount('');
      setGastoDate(new Date().toISOString().slice(0, 10));
    }
    setNewDocs([]);
    setRemovedDocIds([]);
    setError(null);
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rubroId) {
      setError('Selecciona un rubro');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const documents = newDocs.map((d) => ({
        base64: d.base64,
        mime: d.mime,
        filename: d.name,
      }));
      const payload: Record<string, unknown> = {
        rubroId,
        providerId: providerId || undefined,
        description,
        invoiceNumber: invoiceNumber || undefined,
        amount: Number(amount),
        gastoDate,
        kind: tipo === 'SUBCONTRATISTA' ? 'SUBCONTRACTOR' : 'EXPENSE',
        ...(documents.length ? { documents } : {}),
      };
      if (isEdit && initial) {
        // Quitar documentos existentes marcados (incluida la factura legacy).
        const removeDocumentIds = removedDocIds.filter((id) => id !== 'legacy');
        if (removeDocumentIds.length) payload.removeDocumentIds = removeDocumentIds;
        if (removedDocIds.includes('legacy')) payload.invoiceBase64 = null;
        await apiPatch<Gasto>(`/gastos/${initial.id}`, payload);
      } else {
        await apiPost<Gasto>('/gastos', { projectId, ...payload });
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al guardar el gasto');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar gasto' : 'Registrar gasto'}>
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

        <GastoDocsField
          existing={existingDocs}
          removedIds={removedDocIds}
          onToggleRemove={(id) => setRemovedDocIds((prev) => [...prev, id])}
          newDocs={newDocs}
          onAdd={(f) => setNewDocs((prev) => [...prev, f])}
          onRemoveNew={(idx) => setNewDocs((prev) => prev.filter((_, i) => i !== idx))}
          onError={setError}
        />

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Registrar gasto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
