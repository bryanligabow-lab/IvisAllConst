'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { AppShell } from '@/components/layouts/AppShell';
import { CreateProviderModal } from '@/components/forms/CreateProviderModal';
import { apiGet } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type { Provider } from '@/types';

export default function SubcontratistasPage() {
  const { data, isLoading, mutate } = useSWR<Provider[]>(
    '/providers?subcontractor=true',
    apiGet,
  );
  const { can } = useAuthStore();
  const canWrite = can('providers.write');
  const [showCreate, setShowCreate] = useState(false);

  const list = data ?? [];
  const totalAnticipos = list.reduce((s, p) => s + Number(p.totalSubcontract ?? 0), 0);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subcontratistas</h1>
          <p className="text-xs text-ink-secondary">
            Personas/empresas a las que subcontratas obra. Registra sus anticipos como un gasto de
            tipo <strong>Subcontratista</strong> y aquí ves cuánto le has dado a cada uno.
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            + Nuevo subcontratista
          </button>
        )}
      </div>

      {list.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <Metric label="Subcontratistas" value={String(list.length)} icon="👷" />
          <Metric label="Total anticipos / pagos" value={formatCurrency(totalAnticipos)} icon="💰" tone="brand" />
        </div>
      )}

      <CreateProviderModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        asSubcontractor
        onSaved={() => mutate()}
      />

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

      {!isLoading && list.length === 0 && (
        <div className="card text-sm text-ink-secondary">
          Aún no hay subcontratistas. Crea el primero con <strong>+ Nuevo subcontratista</strong>, o
          al registrar un gasto elige el tipo <strong>Subcontratista</strong> y créalo ahí.
        </div>
      )}

      {list.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="table-default table-cards">
            <thead>
              <tr>
                <th>Subcontratista</th>
                <th>RUC / cédula</th>
                <th>Servicio</th>
                <th className="text-right">Anticipos / pagos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td data-label="Subcontratista" className="font-medium">
                    👷 {s.name}
                  </td>
                  <td data-label="RUC / cédula" className="text-xs">{s.ruc || '—'}</td>
                  <td data-label="Servicio" className="text-xs">{s.service || '—'}</td>
                  <td data-label="Anticipos / pagos" className="text-right font-medium">
                    {formatCurrency(Number(s.totalSubcontract ?? 0))}
                  </td>
                  <td data-label="" className="cell-actions">
                    <Link
                      href={`/proveedores/${s.id}`}
                      className="text-xs text-brand hover:underline"
                    >
                      Ver detalle por proyecto →
                    </Link>
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
