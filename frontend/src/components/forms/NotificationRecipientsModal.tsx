'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Modal, Field } from '@/components/ui/Modal';
import { apiDelete, apiGet, apiPatch, apiPost, ApiClientError } from '@/lib/api';

interface Recipient {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  canManage: boolean;
}

// Administra los correos que reciben los informes de estado de las planillas.
export function NotificationRecipientsModal({ open, onClose, canManage }: Props) {
  const { data, mutate } = useSWR<Recipient[]>(open ? '/notifications/recipients' : null, apiGet);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost('/notifications/recipients', {
        email: email.trim(),
        name: name.trim() || undefined,
      });
      setEmail('');
      setName('');
      await mutate();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo agregar el correo');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(r: Recipient) {
    await apiPatch(`/notifications/recipients/${r.id}`, { active: !r.active });
    await mutate();
  }

  async function remove(id: string) {
    await apiDelete(`/notifications/recipients/${id}`);
    await mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Correos para informes de planillas">
      <div className="space-y-4">
        <p className="text-xs text-ink-secondary">
          Estos correos recibirán el <strong>informe diario</strong> del estado de las planillas
          (cuántas presentadas, en contraloría, por cobrar, etc.) una vez se active el envío.
        </p>

        {canManage && (
          <form onSubmit={add} className="rounded-lg border border-surface-border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Correo" required>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input"
                  placeholder="nombre@creacomsa.com"
                />
              </Field>
              <Field label="Nombre (opcional)">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="Ivis Villegas"
                />
              </Field>
            </div>
            {error && <div className="mt-2 text-xs text-danger">{error}</div>}
            <div className="mt-2 flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary text-xs disabled:opacity-50">
                {saving ? 'Agregando…' : '+ Agregar correo'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {data && data.length === 0 && (
            <div className="rounded-md border border-dashed border-surface-border bg-surface-muted/30 px-3 py-4 text-center text-xs text-ink-secondary">
              Aún no hay correos configurados.
            </div>
          )}
          {data?.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-md border border-surface-border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink-primary">{r.email}</div>
                {r.name && <div className="text-xs text-ink-secondary">{r.name}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={r.active ? 'badge-ok' : 'badge-muted'}>
                  {r.active ? 'Activo' : 'Pausado'}
                </span>
                {canManage && (
                  <>
                    <button
                      onClick={() => toggle(r)}
                      className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-surface-muted"
                      title={r.active ? 'Pausar envíos' : 'Reactivar'}
                    >
                      {r.active ? 'Pausar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
                      title="Quitar"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="btn-secondary">
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
