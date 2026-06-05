'use client';

import { useEffect, useState } from 'react';
import { getSessionExpiry, refreshSession } from '@/lib/api';

// Avisar cuando falten 2 minutos para que expire el token de acceso.
const WARN_BEFORE_MS = 2 * 60 * 1000;

export function SessionExpiryWatcher({ onLogout }: { onLogout: () => void }) {
  const [show, setShow] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [extending, setExtending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const tick = () => {
      const exp = getSessionExpiry();
      if (!exp) {
        setShow(false);
        return;
      }
      const rem = exp - Date.now();
      setRemainingMs(rem);
      setShow(rem <= WARN_BEFORE_MS); // incluye rem <= 0 (ya expiró)
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  async function extend() {
    setExtending(true);
    setError(false);
    const ok = await refreshSession();
    setExtending(false);
    if (ok) setShow(false);
    else setError(true);
  }

  if (!show) return null;

  const secs = Math.max(0, Math.round(remainingMs / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const expired = remainingMs <= 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 animate-fade-in">
      <div className="w-full max-w-md rounded-lg border border-surface-border bg-surface shadow-xl">
        <header className="border-b border-surface-border px-5 py-3">
          <h2 className="text-sm font-semibold text-ink-primary">
            {expired ? 'Tu sesión expiró' : 'Tu sesión está por expirar'}
          </h2>
        </header>
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-ink-secondary">
            {expired
              ? 'Tu sesión expiró por inactividad. Amplíala para continuar sin perder lo que estás ingresando.'
              : 'Por seguridad, tu sesión se cerrará pronto. Amplíala para seguir trabajando y no perder lo que estás ingresando.'}
          </p>

          {!expired && (
            <div className="text-center">
              <div className="text-3xl font-bold tracking-widest text-brand tabular-nums">
                {mm}:{ss}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-ink-tertiary">
                tiempo restante
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
              No se pudo ampliar la sesión. Por favor vuelve a iniciar sesión.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onLogout} className="btn-secondary">
              Cerrar sesión
            </button>
            <button
              type="button"
              onClick={extend}
              disabled={extending}
              className="btn-primary disabled:opacity-50"
            >
              {extending ? 'Ampliando…' : 'Ampliar sesión'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
