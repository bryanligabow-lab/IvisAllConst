'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { apiPatch, apiPost, ApiClientError } from '@/lib/api';

export interface Client {
  id: string;
  name: string;
  ruc: string | null;
  address: string | null;
  responsible: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  proformasCount?: number;
  proformasTotal?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Client | null;
  onSaved: (saved: Client) => void;
}

export function CreateClientModal({ open, onClose, initial, onSaved }: Props) {
  const [name, setName] = useState('');
  const [ruc, setRuc] = useState('');
  const [address, setAddress] = useState('');
  const [responsible, setResponsible] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setRuc(initial?.ruc ?? '');
    setAddress(initial?.address ?? '');
    setResponsible(initial?.responsible ?? '');
    setEmail(initial?.email ?? '');
    setPhone(initial?.phone ?? '');
    setNotes(initial?.notes ?? '');
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
        address: address || undefined,
        responsible: responsible || undefined,
        email: email || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
      };
      const saved = initial?.id
        ? ((await apiPatch<Client>(`/clients/${initial.id}`, payload)) as Client)
        : ((await apiPost<Client>('/clients', payload)) as Client);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al guardar el cliente');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar cliente' : 'Nuevo cliente'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Nombre / razón social" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input"
            placeholder="IGLESIA DE JESUCRISTO DE LOS SANTOS DE LOS ULTIMOS DIAS"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="RUC / cédula">
            <input value={ruc} onChange={(e) => setRuc(e.target.value)} className="input" />
          </Field>
          <Field label="Responsable">
            <input
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              className="input"
              placeholder="Emilio Castro"
            />
          </Field>
        </div>
        <Field label="Dirección">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="input"
            placeholder="ROBLES E4-151 Y AMAZONAS"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Teléfono">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Notas internas">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="input"
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
            {submitting ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
