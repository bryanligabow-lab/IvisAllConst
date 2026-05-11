'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { AppShell } from '@/components/layouts/AppShell';
import { CreateProjectModal } from '@/components/forms/CreateProjectModal';
import { apiGet } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { ROUTES } from '@/lib/constants';
import type { Project } from '@/types';

const STATUS_LABEL: Record<Project['status'], string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  PAUSED: 'Pausado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

export default function DashboardPage() {
  const { data, error, isLoading, mutate } = useSWR<Project[]>('/projects', apiGet);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-medium">Dashboard</h1>
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

      {data && (
        <>
          <Metrics projects={data} />
          <h2 className="mt-6 mb-3 text-sm font-medium">Proyectos</h2>
          <div className="space-y-3">
            {data.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
            {data.length === 0 && (
              <div className="card text-sm text-ink-secondary">No hay proyectos todavía.</div>
            )}
          </div>
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

function Metrics({ projects }: { projects: Project[] }) {
  const active = projects.filter((p) => p.status === 'ACTIVE').length;
  const totalContract = projects.reduce((acc, p) => acc + Number(p.contractAmount), 0);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <MetricCard label="Proyectos activos" value={String(active)} />
      <MetricCard label="Total contratado" value={formatCurrency(totalContract)} />
      <MetricCard label="Proyectos totales" value={String(projects.length)} />
      <MetricCard label="Borradores" value={String(projects.filter((p) => p.status === 'DRAFT').length)} />
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="metric-card">
      <div className="text-xs text-ink-secondary">{label}</div>
      <div className="mt-1 text-xl font-medium">{value}</div>
      {sub && <div className="text-xs text-ink-secondary">{sub}</div>}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const contract = Number(project.contractAmount);
  return (
    <Link
      href={ROUTES.PROJECT_BUDGET(project.id)}
      className="block rounded-lg border border-surface-border bg-surface px-5 py-4 transition-colors hover:border-ink-tertiary"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium">{project.name}</div>
          <div className="text-xs text-ink-secondary">
            {project.code} {project.contractor ? `· Contratante: ${project.contractor}` : ''}
          </div>
        </div>
        <span className="badge-muted">{STATUS_LABEL[project.status]}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-secondary">
        <span>💰 {formatCurrency(contract)}</span>
        <span>
          📅 {formatDate(project.startDate)} — {formatDate(project.endDate)}
        </span>
      </div>
    </Link>
  );
}
