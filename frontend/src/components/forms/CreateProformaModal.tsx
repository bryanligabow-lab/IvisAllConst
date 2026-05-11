'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Modal, Field } from '@/components/ui/Modal';
import { apiGet, apiPost, ApiClientError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Project } from '@/types';

interface Item {
  quantity: string;
  unit: string;
  description: string;
  unitPrice: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

const DEFAULT_TOP_CLIENTS = `GAD Canton El Empalme.
Ambiesa S.A.
Ministerio de Educación, coordinacion zonal`;

export function CreateProformaModal({ open, onClose, onCreated }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [clientName, setClientName] = useState('');
  const [clientRuc, setClientRuc] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientResponsible, setClientResponsible] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projectLabel, setProjectLabel] = useState('');
  const [ivaPercent, setIvaPercent] = useState('15');
  const [creditTerm, setCreditTerm] = useState('30 días');
  const [paymentTerms, setPaymentTerms] = useState('100% contraentrega');
  const [validity, setValidity] = useState('10 días');
  const [topClients, setTopClients] = useState(DEFAULT_TOP_CLIENTS);
  const [signerName, setSignerName] = useState('Gabriel Constantine L.');
  const [signerTitle, setSignerTitle] = useState('Gerente General');
  const [items, setItems] = useState<Item[]>([
    { quantity: '1', unit: 'GBL', description: '', unitPrice: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: projects } = useSWR<Project[]>('/projects', apiGet);

  useEffect(() => {
    if (!open) return;
    setDate(new Date().toISOString().slice(0, 10));
    setClientName('');
    setClientRuc('');
    setClientAddress('');
    setClientResponsible('');
    setProjectId('');
    setProjectLabel('');
    setIvaPercent('15');
    setItems([{ quantity: '1', unit: 'GBL', description: '', unitPrice: '' }]);
    setError(null);
  }, [open]);

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((curr) => curr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((c) => [...c, { quantity: '1', unit: 'GBL', description: '', unitPrice: '' }]);
  }

  function removeItem(idx: number) {
    setItems((c) => (c.length === 1 ? c : c.filter((_, i) => i !== idx)));
  }

  const subtotal = items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0,
  );
  const iva = subtotal * (Number(ivaPercent) / 100);
  const total = subtotal + iva;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.some((it) => !it.description.trim())) {
      setError('Todos los ítems necesitan una descripción.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        date,
        clientName,
        clientRuc: clientRuc || undefined,
        clientAddress: clientAddress || undefined,
        clientResponsible: clientResponsible || undefined,
        projectId: projectId || undefined,
        projectLabel: projectLabel || undefined,
        ivaPercent: Number(ivaPercent),
        creditTerm,
        paymentTerms,
        validity,
        topClients,
        signerName,
        signerTitle,
        items: items.map((it) => ({
          quantity: Number(it.quantity),
          unit: it.unit,
          description: it.description,
          unitPrice: Number(it.unitPrice),
        })),
      };
      const created = (await apiPost<{ id: string }>('/proformas', payload)) as { id: string };
      onCreated(created.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al crear la proforma');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva proforma" width="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cliente */}
        <div className="rounded-lg border border-surface-border p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
            Cliente
          </div>
          <div className="space-y-3">
            <Field label="Nombre / razón social" required>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                className="input"
                placeholder="IGLESIA DE JESUCRISTO DE LOS SANTOS DE LOS ULTIMOS DIAS"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="RUC">
                <input value={clientRuc} onChange={(e) => setClientRuc(e.target.value)} className="input" />
              </Field>
              <Field label="Responsable">
                <input
                  value={clientResponsible}
                  onChange={(e) => setClientResponsible(e.target.value)}
                  className="input"
                />
              </Field>
            </div>
            <Field label="Dirección">
              <input
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                className="input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Proyecto interno (opcional)">
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="input"
                >
                  <option value="">— Sin proyecto —</option>
                  {projects?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Etiqueta del proyecto (texto)">
                <input
                  value={projectLabel}
                  onChange={(e) => setProjectLabel(e.target.value)}
                  className="input"
                  placeholder="MAPASINGUE"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Ítems */}
        <div className="rounded-lg border border-surface-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Ítems
            </div>
            <button type="button" onClick={addItem} className="btn-secondary text-xs">
              + Añadir línea
            </button>
          </div>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 rounded-md border border-surface-border bg-surface-muted/30 p-2"
              >
                <input
                  value={it.quantity}
                  onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                  className="input col-span-2"
                  placeholder="Cant"
                  type="number"
                  step="0.01"
                  min="0"
                />
                <input
                  value={it.unit}
                  onChange={(e) => updateItem(idx, { unit: e.target.value })}
                  className="input col-span-2"
                  placeholder="UNI"
                />
                <input
                  value={it.description}
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                  className="input col-span-5"
                  placeholder="Descripción"
                  required
                />
                <input
                  value={it.unitPrice}
                  onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                  className="input col-span-2"
                  placeholder="V. Unit"
                  type="number"
                  step="0.01"
                  min="0"
                />
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  className="col-span-1 rounded-md text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger disabled:opacity-30"
                  title="Eliminar línea"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-col items-end gap-1 text-sm">
            <div>
              Subtotal: <span className="font-semibold">{formatCurrency(subtotal, true)}</span>
            </div>
            <div className="flex items-center gap-2">
              IVA{' '}
              <input
                type="number"
                step="0.1"
                value={ivaPercent}
                onChange={(e) => setIvaPercent(e.target.value)}
                className="input w-16"
              />
              %: <span className="font-semibold">{formatCurrency(iva, true)}</span>
            </div>
            <div className="text-base">
              TOTAL:{' '}
              <span className="font-bold text-brand">{formatCurrency(total, true)}</span>
            </div>
          </div>
        </div>

        {/* Condiciones */}
        <div className="rounded-lg border border-surface-border p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
            Condiciones comerciales
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Plazo de crédito">
              <input value={creditTerm} onChange={(e) => setCreditTerm(e.target.value)} className="input" />
            </Field>
            <Field label="Forma de pago">
              <input
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Vigencia">
              <input value={validity} onChange={(e) => setValidity(e.target.value)} className="input" />
            </Field>
          </div>
          <Field label="Principales clientes (uno por línea)">
            <textarea
              value={topClients}
              onChange={(e) => setTopClients(e.target.value)}
              rows={3}
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre del firmante">
              <input value={signerName} onChange={(e) => setSignerName(e.target.value)} className="input" />
            </Field>
            <Field label="Cargo">
              <input value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} className="input" />
            </Field>
          </div>
        </div>

        <Field label="Fecha de emisión">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </Field>

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'Creando…' : 'Crear proforma'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
