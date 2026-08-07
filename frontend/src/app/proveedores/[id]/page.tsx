'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { apiGet, apiPut, ApiClientError } from '@/lib/api';
import { formatCurrency, formatCalendarDate } from '@/lib/format';
import { ROUTES } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';

interface ProjectRow {
  id: string;
  name: string;
  code: string;
  subcontractAmount: number;
  spent: number;
  balance: number;
  pending: number;
  gastosCount: number;
  ordersCount: number;
}

interface ProviderDetail {
  provider: {
    id: string;
    name: string;
    ruc: string | null;
    phone: string | null;
    email: string | null;
    service: string | null;
  };
  totals: {
    totalSpent: number;
    totalDebt: number;
    totalSubcontracted: number;
    totalBalance: number;
  };
  projects: ProjectRow[];
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
  const { data, isLoading, error, mutate } = useSWR<ProviderDetail>(
    `/providers/${params.id}`,
    apiGet,
  );
  const canWrite = useAuthStore().can('providers.write');
  const [adding, setAdding] = useState(false);

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

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Total subcontratado" value={formatCurrency(totals.totalSubcontracted)} tone="brand" />
        <Metric label="Total dado (pagado)" value={formatCurrency(totals.totalSpent)} tone="success" />
        <Metric
          label="Saldo por pagar"
          value={formatCurrency(totals.totalBalance)}
          tone={totals.totalBalance > 0 ? 'danger' : 'default'}
        />
        <Metric label="Proyectos" value={String(projects.length)} />
      </div>

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Por proyecto (subcontratos)</h2>
          {canWrite && (
            <button onClick={() => setAdding(true)} className="btn-secondary text-xs">
              + Agregar trabajo
            </button>
          )}
        </div>

        {adding && (
          <AddSubcontractRow
            providerId={provider.id}
            existingIds={projects.map((p) => p.id)}
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              mutate();
            }}
          />
        )}

        {projects.length === 0 && !adding ? (
          <div className="card text-sm text-ink-secondary">
            Aún no hay trabajos con este proveedor. Usa <strong>+ Agregar trabajo</strong> para
            registrar el valor subcontratado de un proyecto.
          </div>
        ) : projects.length > 0 ? (
          <div className="card overflow-x-auto">
            <table className="table-default">
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th className="text-right">Subcontratado</th>
                  <th className="text-right">Dado (pagado)</th>
                  <th className="text-right">Saldo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <SubcontractRow
                    key={p.id}
                    providerId={provider.id}
                    project={p}
                    canWrite={canWrite}
                    onSaved={() => mutate()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
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

// Una fila de proyecto con el valor subcontratado editable inline.
function SubcontractRow({
  providerId,
  project,
  canWrite,
  onSaved,
}: {
  providerId: string;
  project: ProjectRow;
  canWrite: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(project.subcontractAmount || ''));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const amount = Number(val) || 0;
      await apiPut(`/providers/${providerId}/subcontract`, { projectId: project.id, amount });
      setEditing(false);
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>
        <Link
          href={ROUTES.PROJECT_BUDGET(project.id)}
          className="font-medium text-brand hover:underline"
        >
          {project.name}
        </Link>
        <div className="text-xs text-ink-secondary">
          {project.code} · {project.gastosCount} gastos · {project.ordersCount} órdenes
        </div>
      </td>
      <td className="text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <input
              type="number"
              step="any"
              min="0"
              autoFocus
              value={val}
              onChange={(e) => setVal(e.target.value)}
              className="input h-8 w-28 text-right text-xs"
            />
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary h-8 px-2 text-[11px] disabled:opacity-50"
            >
              {saving ? '…' : 'Guardar'}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setVal(String(project.subcontractAmount || ''));
                setErr(null);
              }}
              className="text-[11px] text-ink-tertiary hover:underline"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1.5">
            <span className={project.subcontractAmount > 0 ? 'font-medium text-brand' : 'text-ink-tertiary'}>
              {project.subcontractAmount > 0 ? formatCurrency(project.subcontractAmount) : '—'}
            </span>
            {canWrite && (
              <button
                onClick={() => setEditing(true)}
                className="rounded px-1 text-ink-tertiary hover:text-ink-primary"
                title="Editar valor subcontratado"
              >
                ✏️
              </button>
            )}
          </div>
        )}
        {err && <div className="text-[10px] text-danger">{err}</div>}
      </td>
      <td className="text-right">{formatCurrency(project.spent)}</td>
      <td className={`text-right font-medium ${project.balance > 0 ? 'text-danger' : project.balance < 0 ? 'text-warning' : 'text-success'}`}>
        {formatCurrency(project.balance)}
      </td>
      <td></td>
    </tr>
  );
}

// Fila para agregar un trabajo (proyecto + valor subcontratado) que aún no está.
function AddSubcontractRow({
  providerId,
  existingIds,
  onClose,
  onSaved,
}: {
  providerId: string;
  existingIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: projects } = useSWR<Array<{ id: string; name: string; code: string }>>(
    '/projects?perPage=500',
    apiGet,
  );
  const [projectId, setProjectId] = useState('');
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const options = (projects ?? []).filter((p) => !existingIds.includes(p.id));

  async function save() {
    if (!projectId) {
      setErr('Elige un proyecto');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await apiPut(`/providers/${providerId}/subcontract`, {
        projectId,
        amount: Number(val) || 0,
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'No se pudo guardar');
      setSaving(false);
    }
  }

  return (
    <div className="mb-2 rounded-lg border border-brand/40 bg-surface p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[200px]">
          <span className="mb-1 block text-xs text-ink-secondary">Proyecto</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="input text-sm"
          >
            <option value="">— Elige un proyecto —</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </label>
        <label className="w-40">
          <span className="mb-1 block text-xs text-ink-secondary">Valor subcontratado</span>
          <input
            type="number"
            step="any"
            min="0"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="0.00"
            className="input text-sm"
          />
        </label>
        <button onClick={save} disabled={saving} className="btn-primary text-xs disabled:opacity-50">
          {saving ? 'Guardando…' : 'Agregar'}
        </button>
        <button onClick={onClose} className="btn-secondary text-xs">
          Cancelar
        </button>
      </div>
      {err && <div className="mt-1 text-xs text-danger">{err}</div>}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'danger' | 'brand';
}) {
  const colour =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-danger'
        : tone === 'brand'
          ? 'text-brand'
          : 'text-ink-primary';
  return (
    <div className="metric-card">
      <div className="text-xs text-ink-secondary">{label}</div>
      <div className={`mt-1 text-xl font-medium ${colour}`}>{value}</div>
    </div>
  );
}
