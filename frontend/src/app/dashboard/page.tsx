'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { AppShell } from '@/components/layouts/AppShell';
import { CreateProjectModal } from '@/components/forms/CreateProjectModal';
import { EcuadorMap } from '@/components/ui/EcuadorMap';
import { apiDelete, apiGet, ApiClientError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { ROUTES } from '@/lib/constants';
import type { Project, Provider } from '@/types';

interface DashboardProjectStat {
  id: string;
  code: string;
  name: string;
  contractor: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  status: Project['status'];
  startDate: string | null;
  endDate: string | null;
  contractAmount: number;
  budgeted: number;
  spent: number;
  pending: number;
  balance: number;
  progressContract: number;
  progressBudget: number;
}

interface DashboardStats {
  projects: DashboardProjectStat[];
  totals: {
    contractAmount: number;
    budgeted: number;
    spent: number;
    balance: number;
    pendingOrders: number;
    activeCount: number;
  };
}

const STATUS_LABEL: Record<Project['status'], string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  PAUSED: 'Pausado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

const STATUS_CLASS: Record<Project['status'], string> = {
  DRAFT: 'badge-muted',
  ACTIVE: 'badge-ok',
  PAUSED: 'badge-warn',
  COMPLETED: 'badge-ok',
  CANCELLED: 'badge-danger',
};

export default function DashboardPage() {
  const { data: stats, isLoading, error, mutate } = useSWR<DashboardStats>(
    '/projects/stats/global',
    apiGet,
  );
  const [showCreate, setShowCreate] = useState(false);

  async function handleDelete(id: string, name: string) {
    if (
      !window.confirm(
        `¿Eliminar el proyecto "${name}"?\n\nSe borrarán también todos sus rubros, gastos y planillas. Esta acción no se puede deshacer.`,
      )
    )
      return;
    try {
      await apiDelete(`/projects/${id}`);
      mutate();
    } catch (err) {
      window.alert(err instanceof ApiClientError ? err.message : 'No se pudo eliminar el proyecto');
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs text-ink-secondary">
            Visión consolidada de proyectos, presupuestos y deuda con proveedores
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + Nuevo proyecto
        </button>
      </div>

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}
      {error && (
        <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {(error as Error).message}
        </div>
      )}

      {stats && (
        <>
          {/* KPIs */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi
              label="Proyectos activos"
              value={String(stats.totals.activeCount)}
              hint={`${stats.projects.length} en total`}
              icon="🏗️"
            />
            <Kpi
              label="Total contratado"
              value={formatCurrency(stats.totals.contractAmount)}
              hint="Suma de contratos"
              icon="📑"
              tone="brand"
            />
            <Kpi
              label="Ejecutado"
              value={formatCurrency(stats.totals.spent)}
              hint={
                stats.totals.budgeted > 0
                  ? `${Math.round((stats.totals.spent / stats.totals.budgeted) * 100)}% del presupuesto`
                  : 'Sin presupuesto'
              }
              icon="💸"
            />
            <Kpi
              label="Por pagar a proveedores"
              value={formatCurrency(stats.totals.pendingOrders)}
              hint="Órdenes pendientes"
              icon="⏳"
              tone={stats.totals.pendingOrders > 0 ? 'danger' : 'default'}
            />
          </div>

          {/* Mapa Ecuador */}
          <div className="mb-6">
            <EcuadorMap projects={stats.projects as unknown as Project[]} />
          </div>

          {/* Avance por proyecto */}
          <section className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">Avance por proyecto</h2>
            {stats.projects.length === 0 ? (
              <div className="card text-sm text-ink-secondary">
                No hay proyectos todavía. Crea el primero para verlo aquí.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {stats.projects.map((p) => (
                  <ProjectProgressCard key={p.id} project={p} onDelete={() => handleDelete(p.id, p.name)} />
                ))}
              </div>
            )}
          </section>

          <DebtSection />
        </>
      )}

      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => mutate()}
      />
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: string;
  tone?: 'default' | 'brand' | 'danger' | 'success';
}) {
  const valueColour =
    tone === 'brand'
      ? 'text-brand'
      : tone === 'danger'
        ? 'text-danger'
        : tone === 'success'
          ? 'text-success'
          : 'text-ink-primary';
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between">
        <div className="text-xs text-ink-secondary">{label}</div>
        {icon && <div className="text-base opacity-70">{icon}</div>}
      </div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${valueColour}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-tertiary">{hint}</div>}
    </div>
  );
}

function ProjectProgressCard({
  project,
  onDelete,
}: {
  project: DashboardProjectStat;
  onDelete: () => void;
}) {
  const pctBudget = Math.round(project.progressBudget * 100);
  const isOver = project.budgeted > 0 && project.spent > project.budgeted;
  const pctContract = Math.round(project.progressContract * 100);

  return (
    <div className="card relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onDelete();
        }}
        className="absolute right-3 top-3 rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
        title="Eliminar proyecto"
      >
        🗑️
      </button>
      <Link href={ROUTES.PROJECT_BUDGET(project.id)} className="block">
        <div className="flex items-start justify-between gap-3 pr-8">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{project.name}</div>
            <div className="text-xs text-ink-secondary">
              {project.code}
              {project.city ? ` · 📍 ${project.city}` : ''}
            </div>
          </div>
          <span className={STATUS_CLASS[project.status]}>{STATUS_LABEL[project.status]}</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <Stat label="Contratado" value={formatCurrency(project.contractAmount)} />
          <Stat label="Ejecutado" value={formatCurrency(project.spent)} />
          <Stat
            label="Pendiente pago"
            value={formatCurrency(project.pending)}
            tone={project.pending > 0 ? 'danger' : 'default'}
          />
        </div>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="text-ink-secondary">
              Ejecución vs presupuesto
              {project.budgeted === 0 && (
                <span className="ml-1 text-ink-tertiary">(sin rubros)</span>
              )}
            </span>
            <span className={`font-semibold ${isOver ? 'text-danger' : 'text-ink-primary'}`}>
              {pctBudget}%
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full transition-all ${
                isOver
                  ? 'bg-danger'
                  : pctBudget > 85
                    ? 'bg-warning'
                    : 'bg-gradient-to-r from-brand to-brand-accent'
              }`}
              style={{ width: `${Math.min(100, pctBudget)}%` }}
            />
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="text-ink-secondary">Ejecución vs contrato</span>
            <span className="font-semibold">{pctContract}%</span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full bg-success transition-all"
              style={{ width: `${Math.min(100, pctContract)}%` }}
            />
          </div>
        </div>

        {(project.startDate || project.endDate) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-secondary">
            <span>📅 {formatDate(project.startDate)} — {formatDate(project.endDate)}</span>
          </div>
        )}
      </Link>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="rounded-md bg-surface-muted/60 p-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-secondary">{label}</div>
      <div
        className={`mt-0.5 font-semibold ${tone === 'danger' ? 'text-danger' : 'text-ink-primary'}`}
      >
        {value}
      </div>
    </div>
  );
}

function DebtSection() {
  const { data } = useSWR<Provider[]>('/providers', apiGet);
  const withDebt = data?.filter((p) => Number(p.totalDebt ?? 0) > 0) ?? [];
  if (!data || withDebt.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Proveedores con deuda</h2>
        <Link href="/proveedores" className="text-xs text-brand hover:underline">
          Ver todos →
        </Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="table-default">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Servicio</th>
              <th className="text-right">Deuda total</th>
              <th>En cuántos proyectos</th>
            </tr>
          </thead>
          <tbody>
            {withDebt.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/proveedores/${p.id}`} className="font-medium text-brand hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="text-xs">{p.service || '—'}</td>
                <td className="text-right font-medium text-danger">
                  {formatCurrency(Number(p.totalDebt ?? 0))}
                </td>
                <td className="text-xs">{Number(p.projectsWithDebtCount ?? 0)} proyecto(s)</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
