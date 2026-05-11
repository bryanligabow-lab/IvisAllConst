'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { ProjectTabs } from '@/components/layouts/ProjectTabs';
import { apiGet } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { ProjectSummary, Provider } from '@/types';

export default function ProjectProvidersPage() {
  const params = useParams<{ id: string }>();
  const { data: summary } = useSWR<ProjectSummary>(
    `/projects/${params.id}/summary`,
    apiGet,
  );
  const { data: providers, isLoading } = useSWR<Provider[]>(
    `/providers?projectId=${params.id}`,
    apiGet,
  );

  return (
    <AppShell>
      <ProjectTabs projectId={params.id} />

      <div className="mb-4">
        <h1 className="text-lg font-medium">
          Proveedores del proyecto {summary ? `— ${summary.project.name}` : ''}
        </h1>
        <p className="mt-1 text-xs text-ink-secondary">
          Lista de proveedores con gastos u órdenes registrados en este proyecto.
        </p>
      </div>

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

      {providers && providers.length === 0 && (
        <div className="card text-sm text-ink-secondary">
          Aún no hay proveedores con actividad en este proyecto. Asigna un proveedor al crear un
          gasto o una orden de pago.
        </div>
      )}

      {providers && providers.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="table-default">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Servicio</th>
                <th className="text-right">Gastado en este proyecto</th>
                <th className="text-right">Pendiente</th>
                <th>Ver detalle global</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-xs">{p.service || '—'}</td>
                  <td className="text-right">{formatCurrency(Number(p.totalSpent ?? 0))}</td>
                  <td className={`text-right ${Number(p.totalDebt) > 0 ? 'text-danger font-medium' : ''}`}>
                    {formatCurrency(Number(p.totalDebt ?? 0))}
                  </td>
                  <td>
                    <Link href={`/proveedores/${p.id}`} className="text-xs text-brand hover:underline">
                      Abrir ficha →
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
