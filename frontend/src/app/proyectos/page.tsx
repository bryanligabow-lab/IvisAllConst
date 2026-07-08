'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { apiDelete, apiGet } from '@/lib/api';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { formatCurrency } from '@/lib/format';
import { API_BASE_URL, ROUTES, STORAGE_KEYS } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import type { Project } from '@/types';

interface ProjectStat {
  id: string;
  code: string;
  name: string;
  contractor: string | null;
  city: string | null;
  status: Project['status'];
  contractAmount: number;
  spent: number;
  planillado: number;
  porCobrar: number;
  pending: number;
}

interface Stats {
  projects: ProjectStat[];
  totals: {
    contractAmount: number;
    spent: number;
    planillado: number;
    porCobrar: number;
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

async function downloadReport() {
  const token =
    typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) : null;
  const res = await fetch(`${API_BASE_URL}/projects/report/export`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    window.alert('No se pudo generar el reporte');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `creacom-informe-proyectos-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ProyectosReportPage() {
  const { data, isLoading, error, mutate } = useSWR<Stats>('/projects/stats/global', apiGet);
  const { can } = useAuthStore();
  const canDelete = can('projects.delete');
  const [filter, setFilter] = useState<'ALL' | Project['status']>('ALL');
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const q = query.trim().toLowerCase();
  const filteredProjects =
    data?.projects.filter((p) => {
      if (filter !== 'ALL' && p.status !== filter) return false;
      if (q) {
        const hay =
          p.name.toLowerCase().includes(q) ||
          (p.code ?? '').toLowerCase().includes(q) ||
          (p.contractor ?? '').toLowerCase().includes(q) ||
          (p.city ?? '').toLowerCase().includes(q);
        if (!hay) return false;
      }
      return true;
    }) ?? [];

  return (
    <AppShell>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={ROUTES.DASHBOARD} className="mb-1 inline-flex items-center gap-1 text-xs text-brand hover:underline">
            ← Inicio
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Informe de proyectos</h1>
          <p className="text-xs text-ink-secondary">
            Reporte consolidado de todos los proyectos · listo para gerencia
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input w-full sm:w-56"
            placeholder="🔍 Buscar proyecto…"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'ALL' | Project['status'])}
            className="input w-44"
          >
            <option value="ALL">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="DRAFT">Borradores</option>
            <option value="PAUSED">Pausados</option>
            <option value="COMPLETED">Completados</option>
            <option value="CANCELLED">Cancelados</option>
          </select>
          <button onClick={downloadReport} className="btn-success">
            📊 Exportar a Excel
          </button>
        </div>
      </div>

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}
      {error && (
        <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          {/* Resumen ejecutivo en la parte superior */}
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat
              label="Proyectos activos"
              value={String(data.totals.activeCount)}
              hint={`${data.projects.length} en total`}
              icon="🏗️"
            />
            <Stat
              label="Contratado"
              value={formatCurrency(data.totals.contractAmount)}
              icon="📑"
              tone="brand"
            />
            <Stat label="Invertido" value={formatCurrency(data.totals.spent)} icon="💸" />
            <Stat
              label="Por cobrar al cliente"
              value={formatCurrency(data.totals.porCobrar)}
              icon="📥"
              tone={data.totals.porCobrar > 0 ? 'success' : 'default'}
            />
            <Stat
              label="Por pagar"
              value={formatCurrency(data.totals.pendingOrders)}
              icon="⏳"
              tone={data.totals.pendingOrders > 0 ? 'danger' : 'default'}
            />
          </div>

          {/* Tabla consolidada */}
          <div className="card overflow-x-auto p-0">
            <table className="table-default">
              <thead>
                <tr>
                  <th>N° contrato</th>
                  <th>Proyecto</th>
                  <th>Contratante</th>
                  <th>Ciudad</th>
                  <th>Estado</th>
                  <th className="text-right">Monto contractual</th>
                  <th className="text-right">Invertido</th>
                  <th className="text-right">Planillado</th>
                  <th className="text-right">Por cobrar</th>
                  <th className="text-right">Por pagar</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-sm text-ink-secondary">
                      No hay proyectos para el filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs">{p.code}</td>
                      <td>
                        <Link
                          href={ROUTES.PROJECT_BUDGET(p.id)}
                          className="font-medium text-brand hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="text-xs">{p.contractor || '—'}</td>
                      <td className="text-xs">{p.city || '—'}</td>
                      <td>
                        <span className={STATUS_CLASS[p.status]}>{STATUS_LABEL[p.status]}</span>
                      </td>
                      <td className="text-right font-medium">{formatCurrency(p.contractAmount)}</td>
                      <td className="text-right">{formatCurrency(p.spent)}</td>
                      <td className="text-right">{formatCurrency(p.planillado)}</td>
                      <td
                        className={`text-right ${
                          p.porCobrar > 0 ? 'font-medium text-success' : ''
                        }`}
                      >
                        {formatCurrency(p.porCobrar)}
                      </td>
                      <td
                        className={`text-right ${
                          p.pending > 0 ? 'font-medium text-danger' : ''
                        }`}
                      >
                        {formatCurrency(p.pending)}
                      </td>
                      <td className="text-center">
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setPendingDelete({ id: p.id, name: p.name })}
                            className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
                            title="Eliminar proyecto"
                          >
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredProjects.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-brand bg-brand-light/40">
                    <td colSpan={5} className="font-bold text-brand">
                      TOTAL ({filteredProjects.length})
                    </td>
                    <td className="text-right font-bold text-brand">
                      {formatCurrency(
                        filteredProjects.reduce((s, p) => s + p.contractAmount, 0),
                      )}
                    </td>
                    <td className="text-right font-bold text-brand">
                      {formatCurrency(filteredProjects.reduce((s, p) => s + p.spent, 0))}
                    </td>
                    <td className="text-right font-bold text-brand">
                      {formatCurrency(filteredProjects.reduce((s, p) => s + p.planillado, 0))}
                    </td>
                    <td className="text-right font-bold text-success">
                      {formatCurrency(filteredProjects.reduce((s, p) => s + p.porCobrar, 0))}
                    </td>
                    <td className="text-right font-bold text-danger">
                      {formatCurrency(filteredProjects.reduce((s, p) => s + p.pending, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <p className="mt-4 text-[11px] text-ink-tertiary">
            <strong>Invertido:</strong> suma de gastos registrados (incluye nómina). ·{' '}
            <strong>Planillado:</strong> valor total de planillas aprobadas o pagadas. ·{' '}
            <strong>Por cobrar:</strong> planillas enviadas o aprobadas pendientes de cobro al
            cliente. · <strong>Por pagar:</strong> saldo pendiente de órdenes de pago a
            proveedores.
          </p>
        </>
      )}

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        itemLabel={pendingDelete ? `el proyecto "${pendingDelete.name}"` : ''}
        warning="Se borrarán también todos sus rubros, gastos, planillas, órdenes y proformas asociadas."
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

function Stat({
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
  const c =
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
      <div className={`mt-1 text-xl font-semibold tracking-tight ${c}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-ink-tertiary">{hint}</div>}
    </div>
  );
}
