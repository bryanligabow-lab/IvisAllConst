'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { apiGet } from '@/lib/api';
import { formatCurrency, formatCalendarDate } from '@/lib/format';
import { ROUTES } from '@/lib/constants';

interface ProviderDetail {
  provider: {
    id: string;
    name: string;
    ruc: string | null;
    phone: string | null;
    email: string | null;
    service: string | null;
  };
  totals: { totalSpent: number; totalDebt: number };
  projects: Array<{
    id: string;
    name: string;
    code: string;
    spent: number;
    pending: number;
    gastosCount: number;
    ordersCount: number;
  }>;
  gastos: Array<{
    id: string;
    description: string;
    amount: number;
    gastoDate: string;
    invoiceNumber: string | null;
    project: { id: string; name: string; code: string };
    rubro: { code: string; name: string } | null;
  }>;
  orders: Array<{
    id: string;
    description: string;
    amount: number;
    paidAmount: number;
    pendingAmount: number;
    status: 'PENDING' | 'PAID' | 'CANCELLED';
    scheduledDate: string;
    paidAt: string | null;
    invoiceNumber: string | null;
    project: { id: string; name: string; code: string };
    rubro: { code: string; name: string } | null;
  }>;
}

export default function ProviderDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading, error } = useSWR<ProviderDetail>(
    `/providers/${params.id}`,
    apiGet,
  );

  if (isLoading) {
    return (
      <AppShell>
        <div className="text-sm text-ink-secondary">Cargando proveedor…</div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <Link href="/proveedores" className="text-xs text-brand hover:underline">
          ← Volver a proveedores
        </Link>
        <div className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          No se pudo cargar el proveedor.
        </div>
      </AppShell>
    );
  }

  const { provider, totals, projects, gastos, orders } = data;

  return (
    <AppShell>
      <Link href="/proveedores" className="text-xs text-brand hover:underline">
        ← Volver a proveedores
      </Link>

      <header className="mt-3 mb-5">
        <h1 className="text-xl font-medium">{provider.name}</h1>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary">
          {provider.service && <span>📦 {provider.service}</span>}
          {provider.ruc && <span>🪪 RUC: {provider.ruc}</span>}
          {provider.phone && <span>📞 {provider.phone}</span>}
          {provider.email && <span>✉️ {provider.email}</span>}
        </div>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Metric label="Total pagado histórico" value={formatCurrency(totals.totalSpent)} tone="success" />
        <Metric
          label="Deuda total pendiente"
          value={formatCurrency(totals.totalDebt)}
          tone={totals.totalDebt > 0 ? 'danger' : 'default'}
        />
        <Metric label="Proyectos relacionados" value={String(projects.length)} />
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium">Por proyecto</h2>
        {projects.length === 0 ? (
          <div className="card text-sm text-ink-secondary">
            Aún no hay gastos ni órdenes con este proveedor.
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-default">
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th className="text-right">Pagado</th>
                  <th className="text-right">Pendiente</th>
                  <th>Gastos</th>
                  <th>Órdenes</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={ROUTES.PROJECT_PROVIDERS(p.id)}
                        className="font-medium text-brand hover:underline"
                      >
                        {p.name}
                      </Link>
                      <div className="text-xs text-ink-secondary">{p.code}</div>
                    </td>
                    <td className="text-right">{formatCurrency(p.spent)}</td>
                    <td className={`text-right ${p.pending > 0 ? 'text-danger font-medium' : ''}`}>
                      {formatCurrency(p.pending)}
                    </td>
                    <td className="text-xs">{p.gastosCount}</td>
                    <td className="text-xs">{p.ordersCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium">Órdenes de pago ({orders.length})</h2>
        {orders.length === 0 ? (
          <div className="card text-sm text-ink-secondary">Sin órdenes registradas.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-default">
              <thead>
                <tr>
                  <th>Fecha programada</th>
                  <th>Descripción</th>
                  <th>Proyecto</th>
                  <th>Estado</th>
                  <th className="text-right">Monto</th>
                  <th className="text-right">Pagado</th>
                  <th className="text-right">Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{formatCalendarDate(o.scheduledDate)}</td>
                    <td>{o.description}</td>
                    <td className="text-xs">{o.project.name}</td>
                    <td>
                      <span
                        className={
                          o.status === 'PAID'
                            ? 'badge-ok'
                            : o.status === 'CANCELLED'
                              ? 'badge-muted'
                              : 'badge-warn'
                        }
                      >
                        {o.status === 'PAID' ? 'Pagada' : o.status === 'CANCELLED' ? 'Cancelada' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="text-right">{formatCurrency(o.amount)}</td>
                    <td className="text-right">{formatCurrency(o.paidAmount)}</td>
                    <td className={`text-right ${o.pendingAmount > 0 ? 'text-danger font-medium' : ''}`}>
                      {formatCurrency(o.pendingAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Gastos registrados ({gastos.length})</h2>
        {gastos.length === 0 ? (
          <div className="card text-sm text-ink-secondary">Sin gastos registrados.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-default">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Proyecto</th>
                  <th>Rubro</th>
                  <th>Factura</th>
                  <th className="text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((g) => (
                  <tr key={g.id}>
                    <td>{formatCalendarDate(g.gastoDate)}</td>
                    <td>{g.description}</td>
                    <td className="text-xs">{g.project.name}</td>
                    <td className="text-xs">
                      {g.rubro ? `${g.rubro.code}. ${g.rubro.name}` : '—'}
                    </td>
                    <td className="text-xs">{g.invoiceNumber || '—'}</td>
                    <td className="text-right">{formatCurrency(g.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'danger';
}) {
  const colour =
    tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink-primary';
  return (
    <div className="metric-card">
      <div className="text-xs text-ink-secondary">{label}</div>
      <div className={`mt-1 text-xl font-medium ${colour}`}>{value}</div>
    </div>
  );
}
