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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxW =
    width === 'sm' ? 'max-w-sm' : width === 'lg' ? 'max-w-3xl' : 'max-w-lg';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative w-full ${maxW} rounded-lg border border-surface-border bg-surface shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-surface-border px-5 py-3">
          <h2 className="text-sm font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-secondary transition-colors hover:text-ink-primary"
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
