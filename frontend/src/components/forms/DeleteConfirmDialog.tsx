'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ApiClientError } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  /** What is being deleted, e.g. "este proyecto". Shown in the warning text. */
  itemLabel: string;
  /** Function that performs the actual delete. Receives the 6-digit code. */
  onConfirm: (deleteCode: string) => Promise<void>;
  /** Optional extra warning paragraph. */
  warning?: string;
}

export function DeleteConfirmDialog({ open, onClose, itemLabel, onConfirm, warning }: Props) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode('');
    setError(null);
    setSubmitting(false);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Debes ingresar tu código de 6 dígitos');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(code);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo eliminar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={submitting ? () => {} : onClose} title="Confirmar eliminación" width="sm">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-semibold">Vas a eliminar {itemLabel}.</p>
          <p className="mt-1 text-red-800/80 dark:text-red-200/80">
            Esta acción es permanente. {warning ?? ''}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Código de eliminación (6 dígitos)
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="off"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-2xl tracking-[0.5em] text-center text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="••••••"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            El código que te entregó tu administrador al crear tu usuario.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? 'Eliminando…' : 'Confirmar eliminación'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
