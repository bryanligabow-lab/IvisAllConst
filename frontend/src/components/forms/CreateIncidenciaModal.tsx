'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { apiPost, ApiClientError } from '@/lib/api';
import type { Incidencia } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Incidencia) => void;
}

const MAX_IMAGE_SIZE = 6 * 1024 * 1024; // 6 MB

// Etiquetas amigables para el módulo afectado.
export const MODULE_OPTIONS: { value: string; label: string }[] = [
  { value: 'PROFORMAS', label: 'Proformas' },
  { value: 'PLANILLAS', label: 'Planillas' },
  { value: 'GASTOS', label: 'Gastos' },
  { value: 'ORDENES', label: 'Órdenes de pago' },
  { value: 'PROYECTOS', label: 'Proyectos' },
  { value: 'PROVEEDORES', label: 'Proveedores / Subcontratistas' },
  { value: 'CLIENTES', label: 'Clientes' },
  { value: 'NOMINA', label: 'Nómina' },
  { value: 'DASHBOARD', label: 'Inicio / Dashboard' },
  { value: 'OTRO', label: 'Otro' },
];

const URGENCY_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'BAJA', label: 'Baja', hint: 'Puede esperar' },
  { value: 'MEDIA', label: 'Media', hint: 'Cuando se pueda' },
  { value: 'ALTA', label: 'Alta', hint: 'Urgente, me traba' },
];

function fileToBase64(file: File): Promise<{ dataUrl: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({ dataUrl, base64: dataUrl.replace(/^data:[^;]+;base64,/, '') });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Formulario para reportar un problema del sistema (gerencia). Queda como una
// incidencia con hilo que el técnico (soporte) revisa y responde.
export function CreateIncidenciaModal({ open, onClose, onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [moduleValue, setModuleValue] = useState('OTRO');
  const [urgency, setUrgency] = useState('MEDIA');
  const [imgPreview, setImgPreview] = useState('');
  const [imgBase64, setImgBase64] = useState('');
  const [imgMime, setImgMime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setModuleValue('OTRO');
    setUrgency('MEDIA');
    setImgPreview('');
    setImgBase64('');
    setImgMime('');
    setError(null);
  }, [open]);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Solo se permite una imagen (captura de pantalla o foto).');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError(`"${file.name}" pesa más de 6 MB. Reduce el tamaño y vuelve a intentar.`);
      return;
    }
    const { dataUrl, base64 } = await fileToBase64(file);
    setImgPreview(dataUrl);
    setImgBase64(base64);
    setImgMime(file.type);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        module: moduleValue,
        urgency,
        ...(imgBase64 ? { imageBase64: imgBase64, imageMime: imgMime } : {}),
      };
      const created = (await apiPost('/incidencias', payload)) as Incidencia;
      onSaved(created);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al reportar la incidencia');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Reportar un problema">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Título" required hint="Un resumen corto del problema.">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            className="input"
            placeholder="No me deja guardar el precio en la proforma"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="¿Dónde ocurre?" hint="Módulo o pantalla afectada.">
            <select
              value={moduleValue}
              onChange={(e) => setModuleValue(e.target.value)}
              className="input"
            >
              {MODULE_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Urgencia">
            <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="input">
              {URGENCY_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label} — {u.hint}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Descripción"
          required
          hint="Cuéntame qué pasa, qué esperabas y qué pasó. Mientras más detalle, mejor."
        >
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={5}
            maxLength={4000}
            className="input"
            placeholder="Cuando escribo el precio con muchos decimales el campo se pone rojo y no me deja guardar…"
          />
        </Field>

        <Field
          label="Captura de pantalla (opcional)"
          hint="Una foto o captura ayuda muchísimo a entender el problema."
        >
          <div className="flex items-center gap-3">
            {imgPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgPreview}
                alt="captura"
                className="h-16 w-16 shrink-0 rounded border border-surface-border object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-dashed border-surface-border text-[10px] text-ink-tertiary">
                sin imagen
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="btn-secondary cursor-pointer text-xs">
                {imgPreview ? 'Cambiar imagen' : 'Subir imagen'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </label>
              {imgPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setImgPreview('');
                    setImgBase64('');
                    setImgMime('');
                  }}
                  className="text-[11px] text-danger hover:underline"
                >
                  Quitar
                </button>
              )}
            </div>
          </div>
        </Field>

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'Enviando…' : 'Reportar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
