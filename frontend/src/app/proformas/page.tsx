'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { CreateProformaModal, type ProformaEditData } from '@/components/forms/CreateProformaModal';
import { apiDelete, apiGet } from '@/lib/api';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { formatCurrency, formatCalendarDate } from '@/lib/format';
import { ROUTES } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';

interface ProformaListItem {
  id: string;
  number: string;
  date: string;
  clientName: string;
  projectLabel: string | null;
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED';
  subtotal: number;
  iva: number;
  total: number;
  items: Array<{ id: string }>;
}

const STATUS_LABEL = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};
const STATUS_CLASS = {
  DRAFT: 'badge-muted',
  SENT: 'badge-warn',
  APPROVED: 'badge-ok',
  REJECTED: 'badge-danger',
};

export default function ProformasPage() {
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR<ProformaListItem[]>('/proformas', apiGet);
  const { can } = useAuthStore();
  const canWrite = can('proformas.write');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ProformaEditData | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; number: string; clientName: string } | null>(null);

  async function openEdit(id: string) {
    setLoadingEditId(id);
    try {
      const detail = await apiGet<ProformaEditData>(`/proformas/${id}`);
      setEditing(detail);
    } finally {
      setLoadingEditId(null);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proformas</h1>
          <p className="text-xs text-ink-secondary">
            Cotizaciones formales · Genera PDF idéntico al formato CREACOM o exporta a Excel.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={ROUTES.PRODUCTOS} className="btn-secondary">
            📦 Productos
          </Link>
          {canWrite && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              + Nueva proforma
            </button>
          )}
        </div>
      </div>

      <CreateProformaModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => {
          mutate();
          router.push(`/proformas/${id}`);
        }}
      />

      <CreateProformaModal
        open={!!editing}
        initial={editing}
        onClose={() => setEditing(null)}
        onCreated={() => {
          mutate();
          setEditing(null);
        }}
      />

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        itemLabel={pendingDelete ? `la proforma ${pendingDelete.number} de ${pendingDelete.clientName}` : ''}
        onConfirm={async (code) => {
          if (!pendingDelete) return;
          await apiDelete(`/proformas/${pendingDelete.id}`, { deleteCode: code });
          await mutate();
          setPendingDelete(null);
        }}
      />

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}
      {data && data.length === 0 && (
        <div className="card text-sm text-ink-secondary">
          Aún no hay proformas. Crea la primera con <strong>+ Nueva proforma</strong>.
        </div>
      )}

      {data && data.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="table-default table-cards">
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Proyecto</th>
                <th>Estado</th>
                <th className="text-right">Ítems</th>
                <th className="text-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td data-label="N°" className="font-medium">{p.number}</td>
                  <td data-label="Fecha" className="text-xs">{formatCalendarDate(p.date)}</td>
                  <td data-label="Cliente">
                    <Link href={`/proformas/${p.id}`} className="font-medium text-brand hover:underline">
                      {p.clientName}
                    </Link>
                  </td>
                  <td data-label="Proyecto" className="text-xs">{p.projectLabel || '—'}</td>
                  <td data-label="Estado">
                    <span className={STATUS_CLASS[p.status]}>{STATUS_LABEL[p.status]}</span>
                  </td>
                  <td data-label="Ítems" className="text-right text-xs">{p.items.length}</td>
                  <td data-label="Total" className="text-right font-semibold">{formatCurrency(p.total, true)}</td>
                  <td data-label="" className="cell-actions">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/proformas/${p.id}`}
                        className="rounded-md px-2 py-1 text-xs hover:bg-surface-muted"
                        title="Ver detalle"
                      >
                        👁️
                      </Link>
                      {canWrite && (
                        <>
                          <button
                            onClick={() => openEdit(p.id)}
                            disabled={loadingEditId === p.id}
                            className="rounded-md px-2 py-1 text-xs hover:bg-surface-muted disabled:opacity-50"
                            title="Editar"
                          >
                            {loadingEditId === p.id ? '…' : '✏️'}
                          </button>
                          <button
                            onClick={() => setPendingDelete({ id: p.id, number: p.number, clientName: p.clientName })}
                            className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
