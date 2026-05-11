'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { CreateProformaModal } from '@/components/forms/CreateProformaModal';
import { apiDelete, apiGet, ApiClientError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';

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
  const [showCreate, setShowCreate] = useState(false);

  async function handleDelete(p: ProformaListItem) {
    if (!window.confirm(`¿Eliminar la proforma ${p.number} de ${p.clientName}?`)) return;
    try {
      await apiDelete(`/proformas/${p.id}`);
      mutate();
    } catch (err) {
      window.alert(err instanceof ApiClientError ? err.message : 'No se pudo eliminar');
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
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + Nueva proforma
        </button>
      </div>

      <CreateProformaModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => {
          mutate();
          router.push(`/proformas/${id}`);
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
          <table className="table-default">
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
                  <td className="font-medium">{p.number}</td>
                  <td className="text-xs">{formatDate(p.date)}</td>
                  <td>
                    <Link href={`/proformas/${p.id}`} className="font-medium text-brand hover:underline">
                      {p.clientName}
                    </Link>
                  </td>
                  <td className="text-xs">{p.projectLabel || '—'}</td>
                  <td>
                    <span className={STATUS_CLASS[p.status]}>{STATUS_LABEL[p.status]}</span>
                  </td>
                  <td className="text-right text-xs">{p.items.length}</td>
                  <td className="text-right font-semibold">{formatCurrency(p.total, true)}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/proformas/${p.id}`}
                        className="rounded-md px-2 py-1 text-xs hover:bg-surface-muted"
                        title="Ver detalle"
                      >
                        👁️
                      </Link>
                      <button
                        onClick={() => handleDelete(p)}
                        className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
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
