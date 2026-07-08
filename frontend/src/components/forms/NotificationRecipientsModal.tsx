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
  const { data: mailStatus } = useSWR<{ configured: boolean }>(
    open ? '/notifications/mail-status' : null,
    apiGet,
  );
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendMsg, setSendMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function sendNow() {
    setSending(true);
    setSendMsg(null);
    try {
      const r = (await apiPost('/notifications/send-report', {})) as {
        sent?: boolean;
        recipients?: number;
        skipped?: boolean;
        error?: string;
      };
      if (r.skipped) setSendMsg('El envío aún no está activo (falta la contraseña del correo).');
      else if (r.sent) setSendMsg(`✓ Informe enviado a ${r.recipients} correo(s).`);
      else setSendMsg(r.error ? `No se pudo enviar: ${r.error}` : 'No hay correos activos.');
    } catch (err) {
      setSendMsg(err instanceof ApiClientError ? err.message : 'No se pudo enviar');
    } finally {
      setSending(false);
    }
  }

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

        {/* Estado del envío + prueba */}
        <div className="rounded-lg border border-surface-border p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-ink-secondary">Envío de correos:</span>
            {mailStatus?.configured ? (
              <span className="badge-ok">Activo</span>
            ) : (
              <span className="badge-warn">Pendiente de configurar</span>
            )}
          </div>
          {!mailStatus?.configured && (
            <p className="mt-1 text-ink-tertiary">
              Falta poner la cuenta emisora (correo + contraseña). Una vez configurada, el informe
              se enviará solo cada día.
            </p>
          )}
          {canManage && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={sendNow}
                disabled={sending}
                className="btn-secondary text-xs disabled:opacity-50"
              >
                {sending ? 'Enviando…' : 'Enviar informe ahora'}
              </button>
              {sendMsg && <span className="text-ink-secondary">{sendMsg}</span>}
            </div>
          )}
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
