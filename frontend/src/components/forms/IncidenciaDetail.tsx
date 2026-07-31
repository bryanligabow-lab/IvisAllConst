'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Modal } from '@/components/ui/Modal';
import { AuthImage } from '@/components/ui/AuthImage';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { apiDelete, apiGet, apiPatch, apiPost, ApiClientError } from '@/lib/api';
import { MODULE_OPTIONS } from '@/components/forms/CreateIncidenciaModal';
import { useAuthStore } from '@/stores/authStore';
import type {
  Incidencia,
  IncidenciaEventoTipo,
  IncidenciaStatus,
  IncidenciaUrgency,
} from '@/types';

// Íconos y etiquetas de cada paso del proceso (línea de tiempo).
const EVENTO_INFO: Record<IncidenciaEventoTipo, { icon: string; label: string }> = {
  EN_REVISION: { icon: '👀', label: 'En revisión' },
  DIAGNOSTICO: { icon: '🔍', label: 'Diagnóstico' },
  ARREGLO: { icon: '🔧', label: 'Arreglo aplicado' },
  PRUEBA: { icon: '✅', label: 'Prueba / verificación' },
  DEPLOY: { icon: '🚀', label: 'Desplegado' },
  NOTA: { icon: '📝', label: 'Nota' },
};

interface TimelinePoint {
  ts: string;
  icon: string;
  label: string;
  detalle?: string | null;
  milestone?: boolean;
}

const STATUS_LABEL: Record<IncidenciaStatus, string> = {
  ABIERTA: 'Abierta',
  EN_REVISION: 'En revisión',
  RESUELTA: 'Resuelta',
  CERRADA: 'Cerrada',
};
const STATUS_CLASS: Record<IncidenciaStatus, string> = {
  ABIERTA: 'badge-danger',
  EN_REVISION: 'badge-warn',
  RESUELTA: 'badge-ok',
  CERRADA: 'badge-muted',
};
const URGENCY_LABEL: Record<IncidenciaUrgency, string> = {
  ALTA: '🔴 Alta',
  MEDIA: '🟡 Media',
  BAJA: '🟢 Baja',
};
const MODULE_LABEL = Object.fromEntries(MODULE_OPTIONS.map((m) => [m.value, m.label]));

function fmt(dt: string) {
  return new Date(dt).toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
}

// Detalle de una incidencia: descripción, captura y el hilo de conversación
// entre quien reportó (OPERADOR) y el técnico de soporte (TECNICO), más la
// caja para responder y las acciones de estado (cerrar/reabrir).
export function IncidenciaDetail({ id, onClose, onChanged }: Props) {
  const { data, isLoading, mutate } = useSWR<Incidencia>(id ? `/incidencias/${id}` : null, apiGet);
  const canManage = useAuthStore().can('incidencias.manage');

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  async function send() {
    if (!id || !reply.trim()) return;
    setSending(true);
    setErr(null);
    try {
      await apiPost(`/incidencias/${id}/messages`, { body: reply.trim() });
      setReply('');
      await mutate();
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'No se pudo enviar');
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(status: IncidenciaStatus) {
    if (!id) return;
    setSending(true);
    setErr(null);
    try {
      await apiPatch(`/incidencias/${id}/status`, { status });
      await mutate();
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'No se pudo cambiar el estado');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open={!!id}
      onClose={onClose}
      title={data ? `Incidencia #${data.number}` : 'Incidencia'}
      width="lg"
    >
      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}
      {data && (
        <div className="space-y-4">
          {/* Cabecera */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-ink-primary">{data.title}</h3>
              <span className={STATUS_CLASS[data.status]}>{STATUS_LABEL[data.status]}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-tertiary">
              <span className="badge-muted">{MODULE_LABEL[data.module] ?? data.module}</span>
              <span>{URGENCY_LABEL[data.urgency]}</span>
              <span>
                · Reportó{' '}
                {data.creator ? `${data.creator.firstName} ${data.creator.lastName}` : '—'} ·{' '}
                {fmt(data.createdAt)}
              </span>
            </div>
          </div>

          {/* Descripción original */}
          <div className="rounded-lg border border-surface-border bg-surface-muted/40 p-3">
            <div className="whitespace-pre-wrap text-sm text-ink-primary">{data.description}</div>
            {data.imageMime && (
              <AuthImage
                path={`/incidencias/${data.id}/image`}
                alt="captura"
                className="mt-2 max-h-64 rounded border border-surface-border object-contain"
              />
            )}
          </div>

          {/* Proceso / línea de tiempo: cómo se está atendiendo, paso a paso */}
          {(() => {
            const points: TimelinePoint[] = [
              {
                ts: data.createdAt,
                icon: '📩',
                label: 'Reportada',
                milestone: true,
              },
              ...(data.eventos ?? []).map((e) => ({
                ts: e.createdAt,
                icon: EVENTO_INFO[e.tipo]?.icon ?? '•',
                label: EVENTO_INFO[e.tipo]?.label ?? e.tipo,
                detalle: e.detalle,
              })),
              ...(data.resolvedAt
                ? [{ ts: data.resolvedAt, icon: '✅', label: 'Resuelta', milestone: true }]
                : []),
              ...(data.closedAt
                ? [{ ts: data.closedAt, icon: '🔒', label: 'Cerrada', milestone: true }]
                : []),
            ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
            // Solo mostramos la línea si hay proceso registrado (más que "Reportada").
            if (points.length <= 1) return null;
            return (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
                  Proceso
                </div>
                <ol className="space-y-2 border-l border-surface-border pl-4">
                  {points.map((p, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[22px] flex h-4 w-4 items-center justify-center text-[10px]">
                        {p.icon}
                      </span>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span
                          className={`text-xs ${p.milestone ? 'font-semibold text-ink-primary' : 'font-medium text-ink-secondary'}`}
                        >
                          {p.label}
                        </span>
                        <span className="text-[10px] text-ink-tertiary">{fmt(p.ts)}</span>
                      </div>
                      {p.detalle && (
                        <div className="mt-0.5 text-[11px] text-ink-secondary">{p.detalle}</div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })()}

          {/* Hilo de conversación */}
          {data.messages && data.messages.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
                Conversación
              </div>
              {data.messages.map((m) => {
                const tecnico = m.authorRole === 'TECNICO';
                return (
                  <div
                    key={m.id}
                    className={`flex ${tecnico ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        tecnico
                          ? 'bg-brand/10 text-ink-primary'
                          : 'bg-surface-muted text-ink-primary'
                      }`}
                    >
                      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                        {tecnico
                          ? '🛠️ Soporte técnico'
                          : m.author
                            ? `${m.author.firstName} ${m.author.lastName}`
                            : 'Tú'}{' '}
                        · {fmt(m.createdAt)}
                      </div>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                      {m.imageMime && (
                        <AuthImage
                          path={`/incidencias/messages/${m.id}/image`}
                          alt="adjunto"
                          className="mt-2 max-h-56 rounded border border-surface-border object-contain"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {err && (
            <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{err}</div>
          )}

          {/* Responder (si no está cerrada) */}
          {data.status !== 'CERRADA' && (
            <div className="space-y-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                maxLength={4000}
                className="input"
                placeholder="Escribe una respuesta o aclaración…"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {data.status === 'RESUELTA' && (
                    <button
                      onClick={() => changeStatus('CERRADA')}
                      disabled={sending}
                      className="btn-secondary text-xs disabled:opacity-50"
                      title="Confirmar que quedó resuelto"
                    >
                      🔒 Cerrar
                    </button>
                  )}
                  {(data.status === 'ABIERTA' || data.status === 'EN_REVISION') && canManage && (
                    <button
                      onClick={() => changeStatus('RESUELTA')}
                      disabled={sending}
                      className="btn-secondary text-xs disabled:opacity-50"
                    >
                      ✓ Marcar resuelta
                    </button>
                  )}
                </div>
                <button
                  onClick={send}
                  disabled={sending || !reply.trim()}
                  className="btn-primary text-xs disabled:opacity-50"
                >
                  {sending ? 'Enviando…' : 'Responder'}
                </button>
              </div>
            </div>
          )}

          {data.status === 'CERRADA' && (
            <div className="flex items-center justify-between rounded-md bg-surface-muted/50 px-3 py-2 text-xs text-ink-secondary">
              <span>Esta incidencia está cerrada.</span>
              <button
                onClick={() => changeStatus('ABIERTA')}
                disabled={sending}
                className="text-brand hover:underline disabled:opacity-50"
              >
                Reabrir
              </button>
            </div>
          )}

          {/* Pie: volver y (para gerencia) eliminar la incidencia */}
          <div className="flex items-center justify-between border-t border-surface-border pt-3">
            {canManage ? (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="text-xs text-danger hover:underline"
              >
                🗑️ Eliminar incidencia
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              ← Volver
            </button>
          </div>
        </div>
      )}

      {data && (
        <DeleteConfirmDialog
          open={showDelete}
          onClose={() => setShowDelete(false)}
          itemLabel={`la incidencia #${data.number}`}
          warning="Se borrará la incidencia con todo su hilo y su línea de tiempo."
          onConfirm={async (code) => {
            await apiDelete(`/incidencias/${data.id}`, { deleteCode: code });
            onChanged();
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
