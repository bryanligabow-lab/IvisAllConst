'use client';

import { useEffect, useState } from 'react';

// Evento no estándar de Chrome/Android para instalar la PWA.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';

// Banner para instalar la app en el teléfono.
// - Android/Chrome: botón "Instalar app" (usa el prompt nativo).
// - iOS/Safari: instrucciones (Compartir → Añadir a inicio), porque iOS no
//   expone un prompt automático.
export function InstallPWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
    if (isStandalone) return; // ya está instalada
    if (localStorage.getItem(DISMISS_KEY)) return; // el usuario ya lo cerró

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS Safari: no hay beforeinstallprompt → mostramos instrucciones.
    const ua = nav.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|chrome/i.test(ua);
    if (isIOS && isSafari) {
      setIosHint(true);
      setHidden(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  if (hidden || (!deferred && !iosHint)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 pb-3">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-surface-border bg-surface px-4 py-3 shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="CREACOM" className="h-10 w-10 rounded-lg" />
        <div className="min-w-0 flex-1 text-xs">
          <div className="font-semibold text-ink-primary">Instala CREACOM en tu teléfono</div>
          {deferred ? (
            <div className="text-ink-secondary">Ábrela como app, a pantalla completa.</div>
          ) : (
            <div className="text-ink-secondary">
              Toca <span className="font-semibold">Compartir</span> y luego{' '}
              <span className="font-semibold">“Añadir a inicio”</span>.
            </div>
          )}
        </div>
        {deferred && (
          <button onClick={install} className="btn-primary shrink-0 text-xs">
            Instalar
          </button>
        )}
        <button
          onClick={dismiss}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-ink-secondary hover:text-ink-primary"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
