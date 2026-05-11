'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { CreateClientModal, type Client } from '@/components/forms/CreateClientModal';
import { apiDelete, apiGet, ApiClientError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

export default function ClientesPage() {
  const { data, isLoading, mutate } = useSWR<Client[]>('/clients', apiGet);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  async function handleDelete(c: Client) {
    if (
      !window.confirm(
        `¿Eliminar al cliente "${c.name}"?\n\nLas proformas existentes se conservan pero quedan sin cliente asociado.`,
      )
    )
      return;
    try {
      await apiDelete(`/clients/${c.id}`);
      mutate();
    } catch (err) {
      window.alert(err instanceof ApiClientError ? err.message : 'No se pudo eliminar');
    }
  }

  const totalProf = data?.reduce((s, c) => s + (c.proformasCount ?? 0), 0) ?? 0;
  const totalAmount = data?.reduce((s, c) => s + Number(c.proformasTotal ?? 0), 0) ?? 0;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-xs text-ink-secondary">
            Catálogo central de clientes. Selecciónalos al crear una proforma para evitar
            escribir los datos cada vez.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + Nuevo cliente
        </button>
      </div>

      {data && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <Metric label="Clientes" value={String(data.length)} icon="🧾" />
          <Metric label="Proformas asociadas" value={String(totalProf)} icon="📑" />
          <Metric label="Monto total cotizado" value={formatCurrency(totalAmount)} icon="💰" tone="brand" />
        </div>
      )}

      <CreateClientModal open={showCreate} onClose={() => setShowCreate(false)} onSaved={() => mutate()} />
      <CreateClientModal
        open={!!editing}
        onClose={() => setEditing(null)}
        initial={editing}
        onSaved={() => mutate()}
      />

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

      {data && data.length === 0 && (
        <div className="card text-sm text-ink-secondary">
          Aún no hay clientes. Crea el primero con <strong>+ Nuevo cliente</strong> para usarlo en
          tus proformas.
        </div>
      )}

      {data && data.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="table-default">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>RUC</th>
                <th>Responsable</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th className="text-right">Proformas</th>
                <th className="text-right">Monto cotizado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td className="text-xs">{c.ruc || '—'}</td>
                  <td className="text-xs">{c.responsible || '—'}</td>
                  <td className="text-xs">{c.email || '—'}</td>
                  <td className="text-xs">{c.phone || '—'}</td>
                  <td className="text-right text-xs">{c.proformasCount ?? 0}</td>
                  <td className="text-right">{formatCurrency(Number(c.proformasTotal ?? 0))}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(c)}
                        className="rounded-md px-2 py-1 text-xs hover:bg-surface-muted"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
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

function Metric({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  icon?: string;
  tone?: 'default' | 'brand';
}) {
  const c = tone === 'brand' ? 'text-brand' : 'text-ink-primary';
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between">
        <div className="text-xs text-ink-secondary">{label}</div>
        {icon && <div className="text-base opacity-70">{icon}</div>}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${c}`}>{value}</div>
    </div>
  );
}
