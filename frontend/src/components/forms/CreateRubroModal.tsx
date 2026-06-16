'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { ProviderSelector } from '@/components/forms/ProviderSelector';
import { apiPatch, apiPost, ApiClientError } from '@/lib/api';
import type { RubroSummary } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  nextOrderIndex?: number;
  /** IVA % vigente del proyecto (15 por defecto). */
  projectVatPercent?: number;
  /** Si viene → modo edición del rubro. */
  initial?: RubroSummary | null;
  onCreated: () => void;
}

export function CreateRubroModal({
  open,
  onClose,
  projectId,
  nextOrderIndex = 0,
  projectVatPercent = 15,
  initial = null,
  onCreated,
}: Props) {
  const isEdit = !!initial;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [utilityPercent, setUtilityPercent] = useState('0');
  const [includesVat, setIncludesVat] = useState(false);
  const [budgetedAmount, setBudgetedAmount] = useState('');
  const [touchedBudget, setTouchedBudget] = useState(false);
  // Subcontratación parcial (opcional).
  const [subcontractorId, setSubcontractorId] = useState('');
  const [subcontractAmount, setSubcontractAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill al abrir según modo (crear vs editar).
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setCode(initial.code);
      setName(initial.name);
      setUnit(initial.unit ?? '');
      setQuantity(initial.quantity ? String(initial.quantity) : '');
      setUnitPrice(initial.unitPrice ? String(initial.unitPrice) : '');
      setUtilityPercent(String(initial.utilityPercent ?? 0));
      setIncludesVat(Boolean(initial.includesVat));
      setBudgetedAmount(String(initial.budgetedAmount ?? ''));
      // En edición respetamos el monto guardado (no recalcular automáticamente).
      setTouchedBudget(true);
      setSubcontractorId(initial.subcontractorId ?? '');
      setSubcontractAmount(
        initial.subcontractAmount != null ? String(initial.subcontractAmount) : '',
      );
    } else {
      setCode('');
      setName('');
      setUnit('');
      setQuantity('');
      setUnitPrice('');
      setUtilityPercent('0');
      setIncludesVat(false);
      setBudgetedAmount('');
      setTouchedBudget(false);
      setSubcontractorId('');
      setSubcontractAmount('');
    }
    setError(null);
  }, [open, initial]);

  // Derivados — se recalculan en cada render.
  const q = parseFloat(quantity);
  const p = parseFloat(unitPrice);
  const u = parseFloat(utilityPercent);
  const subtotal = !Number.isNaN(q) && !Number.isNaN(p) ? q * p : 0;
  const utilityAmount = subtotal * ((Number.isFinite(u) ? u : 0) / 100);
  const baseConUtilidad = subtotal + utilityAmount;
  const vatAmount = includesVat ? baseConUtilidad * ((projectVatPercent || 0) / 100) : 0;
  const computedTotal = baseConUtilidad + vatAmount;

  // Auto-llenar el monto presupuestado cuando cambian los componentes,
  // a menos que el usuario lo haya tocado manualmente.
  useEffect(() => {
    if (touchedBudget) return;
    if (computedTotal > 0) setBudgetedAmount(computedTotal.toFixed(2));
  }, [computedTotal, touchedBudget]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const base = {
        code,
        name,
        unit: unit || undefined,
        quantity: quantity ? Number(quantity) : 0,
        unitPrice: unitPrice ? Number(unitPrice) : 0,
        utilityPercent: utilityPercent ? Number(utilityPercent) : 0,
        includesVat,
        budgetedAmount: Number(budgetedAmount),
        subcontractorId: subcontractorId || null,
        subcontractAmount: subcontractorId && subcontractAmount ? Number(subcontractAmount) : null,
      };
      if (isEdit && initial) {
        await apiPatch(`/rubros/${initial.id}`, base);
      } else {
        await apiPost('/rubros', { projectId, ...base, orderIndex: nextOrderIndex });
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al guardar el rubro');
    } finally {
      setSubmitting(false);
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar rubro' : 'Añadir rubro al presupuesto'}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Código" required>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              maxLength={40}
              className="input"
              placeholder="1, 1.1, A-001…"
            />
          </Field>
          <Field label="Unidad">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              maxLength={20}
              className="input"
              placeholder="m², m³, glb, u…"
            />
          </Field>
        </div>

        <Field label="Nombre del rubro" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            className="input"
            placeholder="Hormigón f'c=210 — losa planta 1"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cantidad contratada">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input"
              placeholder="0"
            />
          </Field>
          <Field label="Precio unitario">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="input"
              placeholder="0.00"
            />
          </Field>
        </div>

        <fieldset className="rounded-md border border-border bg-surface-muted px-3 py-2">
          <legend className="px-1 text-xs font-medium text-ink-secondary">
            Margen + IVA del rubro
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Utilidad %" hint="Se suma al subtotal antes del IVA.">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="100"
                value={utilityPercent}
                onChange={(e) => {
                  setUtilityPercent(e.target.value);
                  setTouchedBudget(false);
                }}
                className="input"
              />
            </Field>
            <Field label={`¿Sumar IVA ${projectVatPercent}% al final?`}>
              <select
                value={includesVat ? 'yes' : 'no'}
                onChange={(e) => {
                  setIncludesVat(e.target.value === 'yes');
                  setTouchedBudget(false);
                }}
                className="input"
              >
                <option value="no">No — el monto NO incluye IVA</option>
                <option value="yes">Sí — sumar IVA al total</option>
              </select>
            </Field>
          </div>

          {/* Desglose del cálculo */}
          {subtotal > 0 && (
            <div className="mt-2 space-y-1 rounded-md bg-bg px-3 py-2 text-xs text-ink-secondary">
              <div className="flex justify-between">
                <span>Subtotal (cantidad × precio)</span>
                <span>{fmt(subtotal)}</span>
              </div>
              {utilityAmount > 0 && (
                <div className="flex justify-between">
                  <span>+ Utilidad {utilityPercent}%</span>
                  <span>{fmt(utilityAmount)}</span>
                </div>
              )}
              {includesVat && vatAmount > 0 && (
                <div className="flex justify-between">
                  <span>+ IVA {projectVatPercent}%</span>
                  <span>{fmt(vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1 font-medium text-ink-primary">
                <span>= Total calculado</span>
                <span>{fmt(computedTotal)}</span>
              </div>
            </div>
          )}
        </fieldset>

        <Field label="Monto presupuestado total" required>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={budgetedAmount}
            onChange={(e) => {
              setTouchedBudget(true);
              setBudgetedAmount(e.target.value);
            }}
            required
            className="input"
          />
          <p className="mt-1 text-xs text-ink-secondary">
            Se calcula automático (cantidad × precio + utilidad{includesVat ? ' + IVA' : ''}). Puedes
            ajustarlo a mano si difiere del contrato.
          </p>
        </Field>

        {/* Subcontratación parcial del rubro (opcional) */}
        <fieldset className="rounded-md border border-border bg-surface-muted px-3 py-2">
          <legend className="px-1 text-xs font-medium text-ink-secondary">
            Subcontratación del rubro (opcional)
          </legend>
          <ProviderSelector
            label="Subcontratista de este rubro"
            value={subcontractorId}
            onChange={setSubcontractorId}
          />
          {subcontractorId && (
            <div className="mt-2">
              <Field
                label="Valor a pagar al subcontratista"
                hint="Lo que se le pagará por este rubro. Puedes actualizarlo cuando cambie."
              >
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={subcontractAmount}
                  onChange={(e) => setSubcontractAmount(e.target.value)}
                  className="input"
                  placeholder="0.00"
                />
              </Field>
            </div>
          )}
        </fieldset>

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Añadir rubro'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
