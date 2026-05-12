'use client';

import { useState } from 'react';
import { apiDelete, ApiClientError } from './api';

interface PendingDelete {
  path: string;
  label: string;
  warning?: string;
}

/**
 * Reusable hook for delete actions that require the 6-digit user code.
 *
 *   const del = useDeleteWithCode();
 *   <button onClick={() => del.request({ path: `/gastos/${id}`, label: 'este gasto' })}>X</button>
 *   <DeleteConfirmDialog
 *      open={del.open}
 *      onClose={del.close}
 *      itemLabel={del.label}
 *      onConfirm={async (code) => { await del.confirm(code); onDeleted?.(); }}
 *   />
 */
export function useDeleteWithCode() {
  const [pending, setPending] = useState<PendingDelete | null>(null);

  function request(p: PendingDelete) {
    setPending(p);
  }

  function close() {
    setPending(null);
  }

  async function confirm(code: string) {
    if (!pending) return;
    await apiDelete(pending.path, { deleteCode: code });
  }

  return {
    request,
    close,
    confirm,
    open: !!pending,
    label: pending?.label ?? '',
    warning: pending?.warning,
    isApiClientError: (e: unknown): e is ApiClientError => e instanceof ApiClientError,
  };
}
