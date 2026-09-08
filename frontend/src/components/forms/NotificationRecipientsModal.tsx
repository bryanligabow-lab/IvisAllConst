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

type Scope = 'PLANILLAS' | 'CHEQUES';

interface Props {
  open: boolean;
  onClose: () => void;
  canManage: boolean;
  /** Qué lista se administra: los informes de planillas o los avisos de cheques. */
  scope?: Scope;
}

const COPY: Record<Scope, { title: string; intro: string; boton: string }> = {
  PLANILLAS: {
    title: 'Correos para informes de planillas',
    intro:
      'Estos correos recibirán el <strong>informe diario</strong> del estado de las planillas (cuántas presentadas, en contraloría, por cobrar, etc.).',
    boton: 'Enviar informe ahora',
  },
  CHEQUES: {
    title: 'Correos para avisos de cheques',
    intro:
      'Estos correos reciben tres avisos automáticos: el <strong>resumen semanal</strong> de los cheques por cubrir (lunes 7:00 a. m.), una <strong>alerta el día antes</strong> del cobro y otra <strong>el mismo día</strong> del cobro.',
    boton: 'Enviar resumen semanal ahora',
  },
};

// Administra los correos que reciben los informes automáticos del sistema.
export function NotificationRecipientsModal({ open, onClose, canManage, scope = 'PLANILLAS' }: Props) {
  const copy = COPY[scope];
  const listKey = `/notifications/recipients?scope=${scope}`;
  const { data, mutate } = useSWR<Recipient[]>(open ? listKey : null, apiGet);
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
  // Prueba a UN correo: sirve para ver si el servidor lo acepta (p. ej. cuando
  // un Outlook/Hotmail se está tragando los avisos).
  const [probando, setProbando] = useState<string | null>(null);
  const [pruebaMsg, setPruebaMsg] = useState<Record<string, string>>({});

  async function probar(dest: string) {
    setProbando(dest);
    setPruebaMsg((m) => ({ ...m, [dest]: '' }));
    try {
      const r = (await apiPost(
        scope === 'CHEQUES' ? '/notifications/cheques/send' : '/notifications/send-report',
        scope === 'CHEQUES' ? { kind: 'SEMANA', email: dest } : { email: dest },
      )) as { ok?: boolean; skipped?: boolean; error?: string; messageId?: string };
      setPruebaMsg((m) => ({
        ...m,
        [dest]: r.skipped
          ? 'Envío no configurado'
          : r.ok
            ? '✓ Aceptado por el servidor de correo'
            : `No salió: ${r.error ?? 'error desconocido'}`,
      }));
    } catch (err) {
      setPruebaMsg((m) => ({
        ...m,
        [dest]: err instanceof ApiClientError ? err.message : 'No se pudo enviar',
      }));
    } finally {
      setProbando(null);
    }
  }

  async function sendNow() {
    setSending(true);
    setSendMsg(null);
    try {
      const r = (await apiPost(
        scope === 'CHEQUES' ? '/notifications/cheques/send' : '/notifications/send-report',
        scope === 'CHEQUES' ? { kind: 'SEMANA' } : {},
      )) as {
        sent?: boolean | number;
        recipients?: number;
        skipped?: boolean;
        error?: string;
      };
      if (r.skipped) setSendMsg('El envío aún no está activo (falta la contraseña del correo).');
      else if (r.sent) setSendMsg(`✓ Enviado a ${r.recipients ?? r.sent} correo(s).`);
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
        scope,
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
    <Modal open={open} onClose={onClose} title={copy.title}>
      <div className="space-y-4">
        <p
          className="text-xs text-ink-secondary"
          dangerouslySetInnerHTML={{ __html: copy.intro }}
        />

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
                {pruebaMsg[r.email] && (
                  <div className="mt-0.5 text-[11px] text-ink-tertiary">{pruebaMsg[r.email]}</div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={r.active ? 'badge-ok' : 'badge-muted'}>
                  {r.active ? 'Activo' : 'Pausado'}
                </span>
                {canManage && (
                  <>
                    <button
                      onClick={() => probar(r.email)}
                      disabled={probando === r.email}
                      className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-surface-muted disabled:opacity-50"
                      title="Mandar una prueba solo a este correo"
                    >
                      {probando === r.email ? 'Enviando…' : 'Probar'}
                    </button>
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
          <p className="mt-2 text-ink-tertiary">
            ¿Alguien no los recibe? Usa <strong>Probar</strong> en su fila. Si el servidor lo
            acepta y aun así no le llega, casi siempre está en su carpeta de{' '}
            <strong>correo no deseado</strong> — sobre todo en Hotmail y Outlook: hay que marcarlo
            como deseado y agregar el remitente a contactos.
          </p>
          {canManage && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={sendNow}
                disabled={sending}
                className="btn-secondary text-xs disabled:opacity-50"
              >
                {sending ? 'Enviando…' : copy.boton}
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
