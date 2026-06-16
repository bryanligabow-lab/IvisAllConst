'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { apiPatch, apiPost, ApiClientError } from '@/lib/api';
import type { Product } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Product | null; // si viene → edición
  onSaved: () => void;
}

export function CreateProductModal({ open, onClose, initial, onSaved }: Props) {
  const isEdit = !!initial;
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('U');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setUnit(initial.unit || 'U');
      setDescription(initial.description);
      setUnitPrice(String(initial.unitPrice ?? ''));
    } else {
      setName('');
      setUnit('U');
      setDescription('');
      setUnitPrice('');
    }
    setError(null);
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim() || description.trim().slice(0, 200),
        unit: unit || 'U',
        description: description.trim(),
        unitPrice: Number(unitPrice) || 0,
      };
      if (isEdit && initial) await apiPatch(`/products/${initial.id}`, payload);
      else await apiPost('/products', payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al guardar el producto');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar producto' : 'Nuevo producto'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Nombre del producto" required hint="Nombre corto para buscarlo en el catálogo.">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            className="input"
            placeholder="Televisor Indurama 43''"
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Unidad">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              maxLength={40}
              className="input"
              placeholder="U, GBL…"
            />
          </Field>
          <Field label="Precio unitario" required>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              required
              className="input col-span-2"
              placeholder="0.00"
            />
          </Field>
        </div>
        <Field label="Descripción (lo que sale en el detalle)" required>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            maxLength={500}
            className="input"
            placeholder="Descripción completa del producto que aparecerá en la proforma…"
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
            {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
