'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { AppShell } from '@/components/layouts/AppShell';
import { CreateProjectModal } from '@/components/forms/CreateProjectModal';
import { EcuadorMap } from '@/components/ui/EcuadorMap';
import { apiDelete, apiGet } from '@/lib/api';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { formatCurrency, formatDate } from '@/lib/format';
import { ROUTES } from '@/lib/constants';
import type { Project } from '@/types';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: editingProject } = useSWR<Project>(
    editingId ? `/projects/${editingId}` : null,
    apiGet,
  );

  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs text-ink-secondary">
            Visión consolidada de proyectos y presupuestos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/proveedores" className="btn-secondary text-xs">
            Ver proveedores
          </Link>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            + Nuevo proyecto
          </button>
        </div>
      </div>

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}
      {error && (
        <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {(error as Error).message}
        </div>
      )}

      {stats && (
        <>
          {/* KPIs compactos */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi
              label="Activos"
              value={String(stats.totals.activeCount)}
              hint={`${stats.projects.length} en total`}
              icon="🏗️"
            />
            <Kpi
              label="Total contratado"
              value={formatCurrency(stats.totals.contractAmount)}
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
              label="Por pagar"
              value={formatCurrency(stats.totals.pendingOrders)}
              hint="Órdenes pendientes"
              icon="⏳"
              tone={stats.totals.pendingOrders > 0 ? 'danger' : 'default'}
            />
          </div>

          {/* Layout principal: mapa (izquierda) + lista de proyectos (derecha) */}
          <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
            {/* Mapa */}
            <div className="min-w-0">
              <EcuadorMap
                projects={stats.projects as unknown as Project[]}
                compact
              />
            </div>

            {/* Lista de proyectos */}
            <div className="flex min-h-0 flex-col rounded-lg border border-surface-border bg-surface shadow-soft">
              <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
                <h2 className="text-sm font-semibold">
                  Proyectos ({stats.projects.length})
                </h2>
                <div className="text-[10px] uppercase tracking-wider text-ink-tertiary">
                  Click para abrir
                </div>
              </div>
              <div
                className="flex-1 space-y-2 overflow-y-auto p-3"
                style={{ maxHeight: '560px' }}
              >
                {stats.projects.length === 0 ? (
                  <div className="rounded-md border border-dashed border-surface-border bg-surface-muted/40 p-6 text-center text-sm text-ink-secondary">
                    Aún no hay proyectos. Crea el primero con{' '}
                    <strong>+ Nuevo proyecto</strong>.
                  </div>
                ) : (
                  stats.projects.map((p) => (
                    <ProjectMiniCard
                      key={p.id}
                      project={p}
                      onEdit={() => setEditingId(p.id)}
                      onDelete={() => setPendingDelete({ id: p.id, name: p.name })}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={() => mutate()}
      />
      <CreateProjectModal
        open={!!editingId && !!editingProject}
        onClose={() => setEditingId(null)}
        initial={editingProject}
        onSaved={() => mutate()}
      />

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        itemLabel={pendingDelete ? `el proyecto "${pendingDelete.name}"` : ''}
        warning="Se borrarán también todos sus rubros, gastos y planillas."
        onConfirm={async (code) => {
          if (!pendingDelete) return;
          await apiDelete(`/projects/${pendingDelete.id}`, { deleteCode: code });
          await mutate();
          setPendingDelete(null);
        }}
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
      <div className={`mt-1 text-xl font-semibold tracking-tight ${valueColour}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-ink-tertiary">{hint}</div>}
    </div>
  );
}

function ProjectMiniCard({
  project,
  onEdit,
  onDelete,
}: {
  project: DashboardProjectStat;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pctBudget = Math.round(project.progressBudget * 100);
  const isOver = project.budgeted > 0 && project.spent > project.budgeted;

  return (
    <div className="group relative rounded-lg border border-surface-border bg-surface p-3 transition-all hover:border-brand/60 hover:shadow-card">
      <div className="absolute right-1.5 top-1.5 hidden gap-0.5 group-hover:flex">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onEdit();
          }}
          className="rounded-md px-1.5 py-1 text-xs text-ink-secondary hover:bg-surface-muted hover:text-ink-primary"
          title="Editar"
        >
          ✏️
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }}
          className="rounded-md px-1.5 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
          title="Eliminar"
        >
          🗑️
        </button>
      </div>

      <Link href={ROUTES.PROJECT_BUDGET(project.id)} className="block pr-12">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink-primary">
              {project.name}
            </div>
            <div className="truncate text-[11px] text-ink-secondary">
              {project.code}
              {project.city ? ` · 📍 ${project.city}` : ''}
            </div>
          </div>
          <span className={`${STATUS_CLASS[project.status]} shrink-0`}>
            {STATUS_LABEL[project.status]}
          </span>
        </div>

        <div className="mt-2 flex items-end justify-between text-[11px]">
          <div>
            <span className="text-ink-tertiary">Contratado</span>{' '}
            <span className="font-medium">{formatCurrency(project.contractAmount)}</span>
          </div>
          <div className="text-right">
            <span className="text-ink-tertiary">Ejecutado</span>{' '}
            <span className="font-medium">{formatCurrency(project.spent)}</span>
          </div>
        </div>

        <div className="mt-2">
          <div className="mb-0.5 flex justify-between text-[10px] text-ink-secondary">
            <span>Avance vs presupuesto</span>
            <span className={`font-semibold ${isOver ? 'text-danger' : 'text-ink-primary'}`}>
              {project.budgeted > 0 ? `${pctBudget}%` : '—'}
            </span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-muted">
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

        {project.pending > 0 && (
          <div className="mt-2 flex items-center justify-between rounded-md bg-danger-soft px-2 py-1 text-[10px]">
            <span className="text-danger">Pendiente pago</span>
            <span className="font-semibold text-danger">
              {formatCurrency(project.pending)}
            </span>
          </div>
        )}

        {(project.startDate || project.endDate) && (
          <div className="mt-1 text-[10px] text-ink-tertiary">
            📅 {formatDate(project.startDate)} — {formatDate(project.endDate)}
          </div>
        )}
      </Link>
    </div>
  );
}
