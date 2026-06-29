'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Guarda un borrador del formulario en localStorage (sobrevive a clics afuera,
 * cierre del navegador, caída de internet, etc.) y permite recuperarlo.
 *
 * - `read`: cuando es true (al abrir el form) revisa si hay un borrador guardado.
 * - `write`: cuando es true (form abierto y con contenido) autoguarda con debounce.
 */
export function useDraft<T>(key: string, value: T, read: boolean, write: boolean) {
  const [available, setAvailable] = useState<T | null>(null);

  // Al abrir: ¿hay un borrador guardado de antes?
  useEffect(() => {
    if (!read) return;
    try {
      const raw = localStorage.getItem(key);
      setAvailable(raw ? (JSON.parse(raw) as T) : null);
    } catch {
      setAvailable(null);
    }
  }, [key, read]);

  // Autoguardado con debounce mientras se escribe.
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!write) return;
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* sin espacio / modo privado: lo ignoramos */
      }
    }, 700);
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, [key, value, write]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* noop */
    }
    setAvailable(null);
  }, [key]);

  return { available, clear };
}
