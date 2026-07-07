'use client';

import { useEffect } from 'react';

// Registra el service worker para que la app sea instalable y funcione offline
// lo ya visitado. No renderiza nada.
export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* si falla el registro, la app sigue funcionando como web normal */
      });
    };
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);
  return null;
}
