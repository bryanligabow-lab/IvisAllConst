'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { apiPost, ApiClientError } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  nextOrderIndex?: number;
  onCreated: () => void;
}

export function CreateRubroModal({
  open,
  onClose,
  projectId,
  nextOrderIndex = 0,
  onCreated,
}: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [budgetedAmount, setBudgetedAmount] = useState('');
  const [touchedBudget, setTouchedBudget] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autocomputar presupuestado = cantidad × precio, salvo que el usuario lo edite a mano.
  useEffect(() => {
    if (touchedBudget) return;
    const q = parseFloat(quantity);
    const p = parseFloat(unitPrice);
    if (!Number.isNaN(q) && !Number.isNaN(p)) {
      setBudgetedAmount((q * p).toFixed(2));
    }
  }, [quantity, unitPrice, touchedBudget]);

  function reset() {
    setCode('');
    setName('');
    setUnit('');
    setQuantity('');
    setUnitPrice('');
    setBudgetedAmount('');
    setTouchedBudget(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/rubros', {
        projectId,
        code,
        name,
        unit: unit || undefined,
        quantity: quantity ? Number(quantity) : 0,
        unitPrice: unitPrice ? Number(unitPrice) : 0,
        budgetedAmount: Number(budgetedAmount),
        orderIndex: nextOrderIndex,
      });
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al crear el rubro');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Añadir rubro al presupuesto">
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
              step="0.01"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="input"
              placeholder="0.00"
            />
          </Field>
        </div>

        <Field label="Monto presupuestado total" required>
          <input
            type="number"
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
            Se calcula automático (cantidad × precio). Puedes ajustarlo a mano si difiere del contrato.
          </p>
        </Field>

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'Guardando…' : 'Añadir rubro'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
