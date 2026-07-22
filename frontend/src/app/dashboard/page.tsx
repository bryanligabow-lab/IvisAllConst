'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { AppShell } from '@/components/layouts/AppShell';
import { CreateProjectModal } from '@/components/forms/CreateProjectModal';
import { EcuadorMap } from '@/components/ui/EcuadorMap';
import { apiDelete, apiGet } from '@/lib/api';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { formatCurrency, formatCalendarDate } from '@/lib/format';
import { ROUTES } from '@/lib/constants';
import { PLANILLA_STATUS_LABEL, PLANILLA_STATUS_CLASS } from '@/lib/planillaStatus';
import { PlanillasPendientes } from '@/components/ui/PlanillasPendientes';
import { useAuthStore } from '@/stores/authStore';
import type { PlanillaStatus, Project } from '@/types';

interface DashboardProjectStat {
  id: string;
  code: string;
  name: string;
  contractor: string | null;
  clientName: string | null;
  executionType?: 'OWN' | 'SUBCONTRACTED';
  subcontractorName: string | null;
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
  workProgressPercent?: number;
  porCobrar?: number;
  ingresado?: number;
  managesAdvance?: boolean;
  anticipoRecibido?: number;
  saldoPorDevengar?: number;
  lastPlanillaNumber?: number | null;
  lastPlanillaStatus?: PlanillaStatus | null;
}

interface DashboardStats {
  projects: DashboardProjectStat[];
  totals: {
    contractAmount: number;
    budgeted: number;
    spent: number;
    balance: number;
    pendingOrders: number;
    porCobrar?: number;
    ingresado?: number;
    saldoPorDevengar?: number;
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
  // Buscador de proyectos (por nombre, código o cliente).
  const [projectQuery, setProjectQuery] = useState('');
  const { isRestricted, can } = useAuthStore();
  // El operador ve solo sus proyectos asignados y sin valores monetarios.
  const restricted = isRestricted();
  const canCreateProject = can('projects.create');
  const canManageProjects = can('projects.update');

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {restricted ? 'Mis proyectos' : 'Dashboard'}
          </h1>
          <p className="text-xs text-ink-secondary">
            {restricted
              ? 'Proyectos asignados a tu cuenta'
              : 'Visión consolidada de proyectos y presupuestos'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can('clients.read') && !restricted && (
            <Link href={ROUTES.CLIENTES} className="btn-secondary text-xs">
              Ver clientes
            </Link>
          )}
          {can('providers.read') && (
            <Link href="/proveedores" className="btn-secondary text-xs">
              Ver proveedores
            </Link>
          )}
          {can('providers.read') && !restricted && (
            <Link href={ROUTES.SUBCONTRATISTAS} className="btn-secondary text-xs">
              Subcontratistas
            </Link>
          )}
          {canCreateProject && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              + Nuevo proyecto
            </button>
          )}
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
          {/* KPIs compactos (ocultos para el operador: no ve montos) */}
          <div className={`mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 ${restricted ? 'hidden' : ''}`}>
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
            <Kpi
              label="Por cobrar"
              value={formatCurrency(stats.totals.porCobrar ?? 0)}
              hint="Planillas presentadas sin pagar"
              icon="📋"
              tone={(stats.totals.porCobrar ?? 0) > 0 ? 'brand' : 'default'}
            />
            <Kpi
              label="Ingresado"
              value={formatCurrency(stats.totals.ingresado ?? 0)}
              hint={
                (stats.totals.saldoPorDevengar ?? 0) > 0
                  ? `Anticipos por devengar: ${formatCurrency(stats.totals.saldoPorDevengar ?? 0)}`
                  : 'Anticipos y cobros de planillas'
              }
              icon="💰"
              tone="success"
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
              {stats.projects.length > 0 && (
                <div className="border-b border-surface-border px-3 py-2">
                  <input
                    value={projectQuery}
                    onChange={(e) => setProjectQuery(e.target.value)}
                    className="input w-full text-sm"
                    placeholder="🔍 Buscar proyecto…"
                  />
                </div>
              )}
              <div
                className="flex-1 space-y-2 overflow-y-auto p-3"
                style={{ maxHeight: '560px' }}
              >
                {(() => {
                  const pq = projectQuery.trim().toLowerCase();
                  const shown = pq
                    ? stats.projects.filter(
                        (p) =>
                          p.name.toLowerCase().includes(pq) ||
                          (p.code ?? '').toLowerCase().includes(pq) ||
                          (p.clientName ?? '').toLowerCase().includes(pq),
                      )
                    : stats.projects;
                  if (stats.projects.length === 0) {
                    return (
                      <div className="rounded-md border border-dashed border-surface-border bg-surface-muted/40 p-6 text-center text-sm text-ink-secondary">
                        Aún no hay proyectos. Crea el primero con{' '}
                        <strong>+ Nuevo proyecto</strong>.
                      </div>
                    );
                  }
                  if (shown.length === 0) {
                    return (
                      <div className="p-4 text-center text-sm text-ink-secondary">
                        No hay proyectos que coincidan con “{projectQuery}”.
                      </div>
                    );
                  }
                  return shown.map((p) => (
                    <ProjectMiniCard
                      key={p.id}
                      project={p}
                      hideMoney={restricted}
                      canManage={canManageProjects}
                      onEdit={() => setEditingId(p.id)}
                      onDelete={() => setPendingDelete({ id: p.id, name: p.name })}
                    />
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* Planillas pendientes de cobro (debajo del mapa). El operador no
              ve montos, así que este panel es solo para el resto de roles. */}
          {!restricted && can('ingresos.read') && <PlanillasPendientes />}
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
  hideMoney = false,
  canManage = true,
  onEdit,
  onDelete,
}: {
  project: DashboardProjectStat;
  hideMoney?: boolean;
  canManage?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Utilidad = lo contratado menos lo ejecutado (lo que se ha ganado).
  const utilidad = project.contractAmount - project.spent;
  const utilidadPct =
    project.contractAmount > 0 ? Math.round((utilidad / project.contractAmount) * 100) : 0;
  // Avance FÍSICO de obra (manual). Proyecto completado → 100%.
  const avanceObra = Math.round(
    project.status === 'COMPLETED' && !project.workProgressPercent
      ? 100
      : (project.workProgressPercent ?? 0),
  );

  return (
    <div className="group relative rounded-lg border border-surface-border bg-surface p-3 transition-all hover:border-brand/60 hover:shadow-card">
      {canManage && (
        <div className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
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
      )}

      <Link href={ROUTES.PROJECT_BUDGET(project.id)} className={canManage ? 'block pr-12' : 'block'}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink-primary">
              {project.name}
            </div>
            <div className="truncate text-[11px] text-ink-secondary">
              {project.code}
              {project.city ? ` · 📍 ${project.city}` : ''}
            </div>
            {(project.clientName || project.executionType === 'SUBCONTRACTED') && (
              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px]">
                {project.clientName && (
                  <span className="text-ink-tertiary">👤 {project.clientName}</span>
                )}
                {project.executionType === 'SUBCONTRACTED' && (
                  <span className="badge-warn">
                    Subcontratado{project.subcontractorName ? `: ${project.subcontractorName}` : ''}
                  </span>
                )}
              </div>
            )}
            {/* Seguimiento de cobro: en qué paso va la última planilla */}
            {project.lastPlanillaStatus && (
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                <span className={PLANILLA_STATUS_CLASS[project.lastPlanillaStatus]}>
                  📋 Planilla #{project.lastPlanillaNumber} —{' '}
                  {PLANILLA_STATUS_LABEL[project.lastPlanillaStatus]}
                </span>
              </div>
            )}
          </div>
          <span className={`${STATUS_CLASS[project.status]} shrink-0`}>
            {STATUS_LABEL[project.status]}
          </span>
        </div>

        {!hideMoney && (
          <div className="mt-2 space-y-0.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-ink-tertiary">Contratado</span>
              <span className="font-medium">{formatCurrency(project.contractAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-tertiary">Ejecutado</span>
              <span className="font-medium">{formatCurrency(project.spent)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-tertiary">Utilidad</span>
              <span className={`font-medium ${utilidad < 0 ? 'text-danger' : 'text-success'}`}>
                {formatCurrency(utilidad)}
              </span>
            </div>
            {(project.porCobrar ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-ink-tertiary">Por cobrar</span>
                <span className="font-medium text-warning">
                  {formatCurrency(project.porCobrar ?? 0)}
                </span>
              </div>
            )}
            {project.managesAdvance && (project.saldoPorDevengar ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-ink-tertiary">Anticipo por devengar</span>
                <span className="font-medium text-warning">
                  {formatCurrency(project.saldoPorDevengar ?? 0)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Barra: avance físico de obra */}
        <div className="mt-2">
          <div className="mb-0.5 flex justify-between text-[10px] text-ink-secondary">
            <span>Avance de obra</span>
            <span className="font-semibold text-ink-primary">{avanceObra}%</span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full transition-all ${
                avanceObra >= 100 ? 'bg-success' : 'bg-gradient-to-r from-brand to-brand-accent'
              }`}
              style={{ width: `${Math.min(100, avanceObra)}%` }}
            />
          </div>
        </div>

        {/* Barra: utilidad (% del contrato) + monto */}
        {!hideMoney && (
          <div className="mt-2">
            <div className="mb-0.5 flex justify-between text-[10px] text-ink-secondary">
              <span>Utilidad (vs contrato)</span>
              <span className={`font-semibold ${utilidad < 0 ? 'text-danger' : 'text-success'}`}>
                {utilidadPct}% · {formatCurrency(utilidad)}
              </span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full transition-all ${utilidad < 0 ? 'bg-danger' : 'bg-success'}`}
                style={{ width: `${Math.min(100, Math.max(0, utilidadPct))}%` }}
              />
            </div>
          </div>
        )}

        {!hideMoney && project.pending > 0 && (
          <div className="mt-2 flex items-center justify-between rounded-md bg-danger-soft px-2 py-1 text-[10px]">
            <span className="text-danger">Pendiente pago</span>
            <span className="font-semibold text-danger">
              {formatCurrency(project.pending)}
            </span>
          </div>
        )}

        {(project.startDate || project.endDate) && (
          <div className="mt-1 text-[10px] text-ink-tertiary">
            📅 {formatCalendarDate(project.startDate)} — {formatCalendarDate(project.endDate)}
          </div>
        )}
      </Link>
    </div>
  );
}
