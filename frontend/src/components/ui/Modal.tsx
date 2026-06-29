'use client';

import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, children, width = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    // No cerramos con Escape ni con clic afuera para no perder datos a medio
    // llenar: el modal solo se cierra con la X o el botón Cancelar.
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const maxW =
    width === 'sm' ? 'max-w-sm' : width === 'lg' ? 'max-w-3xl' : 'max-w-lg';

  return (
    <div
      // OJO: hacer clic en el fondo NO cierra el modal (se perdían datos a
      // medio llenar). Solo cierran la X del encabezado o el botón Cancelar.
      className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-black/40 p-0 sm:items-start sm:px-4 sm:py-8"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative flex min-h-full w-full flex-col border-surface-border bg-surface shadow-xl sm:min-h-0 sm:rounded-lg sm:border ${maxW}`}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-border bg-surface px-5 py-3 sm:rounded-t-lg">
          <h2 className="text-sm font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink-primary"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}

export function Field({ label, children, hint, required }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-ink-secondary">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-tertiary">{hint}</span>}
    </label>
  );
}
