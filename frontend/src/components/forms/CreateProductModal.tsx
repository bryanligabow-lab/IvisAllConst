'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { AuthImage } from '@/components/ui/AuthImage';
import { apiPatch, apiPost, ApiClientError } from '@/lib/api';
import type { Product } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Product | null; // si viene → edición
  // Al crear, devuelve el producto creado (para poder usarlo de inmediato).
  onSaved: (created?: Product) => void;
}

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4 MB

function fileToBase64(file: File): Promise<{ dataUrl: string; dataBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({ dataUrl, dataBase64: dataUrl.replace(/^data:[^;]+;base64,/, '') });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function CreateProductModal({ open, onClose, initial, onSaved }: Props) {
  const isEdit = !!initial;
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('U');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  // Imagen: 'keep' = no tocar (edición), 'new' = subió una, 'clear' = quitar.
  const [imgMode, setImgMode] = useState<'keep' | 'new' | 'clear'>('keep');
  const [imgPreview, setImgPreview] = useState('');
  const [imgBase64, setImgBase64] = useState('');
  const [imgMime, setImgMime] = useState('');
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
    setImgMode('keep');
    setImgPreview('');
    setImgBase64('');
    setImgMime('');
    setError(null);
  }, [open, initial]);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > MAX_IMAGE_SIZE) {
      setError(`"${file.name}" pesa más de 4 MB. Reduce el tamaño y vuelve a intentar.`);
      return;
    }
    const { dataUrl, dataBase64 } = await fileToBase64(file);
    setImgPreview(dataUrl);
    setImgBase64(dataBase64);
    setImgMime(file.type);
    setImgMode('new');
    setError(null);
  }

  const showExisting = isEdit && initial?.hasImage && imgMode === 'keep';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const base = {
        name: name.trim() || description.trim().slice(0, 200),
        unit: unit || 'U',
        description: description.trim(),
        unitPrice: Number(unitPrice) || 0,
      };
      // Imagen: solo enviamos el campo cuando cambió.
      const imagePayload =
        imgMode === 'new'
          ? { imageBase64: imgBase64, imageMime: imgMime }
          : imgMode === 'clear'
            ? { imageBase64: null }
            : {};
      const payload = { ...base, ...imagePayload };
      if (isEdit && initial) {
        await apiPatch(`/products/${initial.id}`, payload);
        onSaved();
      } else {
        const created = (await apiPost('/products', payload)) as Product;
        onSaved(created);
      }
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
          <div className="col-span-2">
            <Field label="Precio unitario" required>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                required
                className="input"
                placeholder="0.00"
              />
            </Field>
          </div>
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

        {/* Imagen del producto */}
        <Field
          label="Imagen del producto (opcional)"
          hint="Se copia al ítem de la proforma al elegir el producto y sale al lado del rubro."
        >
          <div className="flex items-center gap-3">
            {imgMode === 'new' && imgPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgPreview}
                alt="nueva"
                className="h-16 w-16 shrink-0 rounded border border-surface-border object-cover"
              />
            ) : showExisting && initial ? (
              <AuthImage
                path={`/products/${initial.id}/image`}
                alt={initial.name}
                className="h-16 w-16 shrink-0 rounded border border-surface-border object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-dashed border-surface-border text-[10px] text-ink-tertiary">
                sin imagen
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="btn-secondary cursor-pointer text-xs">
                {imgMode === 'new' || showExisting ? 'Cambiar imagen' : '📷 Subir imagen'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </label>
              {(imgMode === 'new' || showExisting) && (
                <button
                  type="button"
                  onClick={() => {
                    setImgMode('clear');
                    setImgPreview('');
                    setImgBase64('');
                    setImgMime('');
                  }}
                  className="text-xs text-ink-secondary hover:text-danger"
                >
                  Quitar imagen
                </button>
              )}
            </div>
          </div>
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
