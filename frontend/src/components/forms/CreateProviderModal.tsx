'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { apiPost, apiPatch, ApiClientError } from '@/lib/api';
import type { Provider } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Provider | null; // when set → edit mode
  /** Si es true, el nuevo registro se marca como subcontratista. */
  asSubcontractor?: boolean;
  onSaved: (saved: Provider) => void;
}

export function CreateProviderModal({
  open,
  onClose,
  initial,
  asSubcontractor = false,
  onSaved,
}: Props) {
  const [name, setName] = useState('');
  const [ruc, setRuc] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [service, setService] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setRuc(initial?.ruc ?? '');
    setPhone(initial?.phone ?? '');
    setEmail(initial?.email ?? '');
    setService(initial?.service ?? '');
    setError(null);
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name,
        ruc: ruc || undefined,
        phone: phone || undefined,
        email: email || undefined,
        service: service || undefined,
      };
      let saved: Provider;
      if (initial?.id) {
        saved = (await apiPatch<Provider>(`/providers/${initial.id}`, payload)) as Provider;
      } else {
        saved = (await apiPost<Provider>('/providers', {
          ...payload,
          ...(asSubcontractor ? { isSubcontractor: true } : {}),
        })) as Provider;
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al guardar el proveedor');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        initial
          ? 'Editar proveedor'
          : asSubcontractor
            ? 'Nuevo subcontratista'
            : 'Nuevo proveedor'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label={asSubcontractor ? 'Nombre del subcontratista' : 'Nombre / razón social'} required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            className="input"
            placeholder={asSubcontractor ? 'Juan Pérez (maestro de obra)' : 'Brajan Suministros'}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="RUC / cédula">
            <input
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              maxLength={40}
              className="input"
              placeholder="0912345678001"
            />
          </Field>
          <Field label="Teléfono">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
              className="input"
              placeholder="0991234567"
            />
          </Field>
        </div>

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
            className="input"
            placeholder="contacto@proveedor.com"
          />
        </Field>

        <Field label="Tipo de producto / servicio">
          <input
            value={service}
            onChange={(e) => setService(e.target.value)}
            maxLength={300}
            className="input"
            placeholder="Tuberías y accesorios PVC"
          />
        </Field>

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear proveedor'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
