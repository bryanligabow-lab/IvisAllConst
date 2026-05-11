'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layouts/AppShell';
import { ProjectTabs } from '@/components/layouts/ProjectTabs';
import { CreatePlanillaModal } from '@/components/forms/CreatePlanillaModal';
import { apiDelete, apiGet, ApiClientError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import type { Planilla, PlanillaStatus, ProjectSummary } from '@/types';

const STATUS_LABEL: Record<PlanillaStatus, string> = {
  DRAFT: 'Borrador',
  SUBMITTED: 'Enviada',
  APPROVED: 'Aprobada',
  PAID: 'Pagada',
  CANCELLED: 'Cancelada',
};

const STATUS_CLASS: Record<PlanillaStatus, string> = {
  DRAFT: 'badge-muted',
  SUBMITTED: 'badge-warn',
  APPROVED: 'badge-ok',
  PAID: 'badge-ok',
  CANCELLED: 'badge-danger',
};

async function downloadExcel(planillaId: string): Promise<void> {
  const token =
    typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) : null;
  const res = await fetch(`${API_BASE_URL}/planillas/${planillaId}/export`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    alert('No se pudo descargar el Excel');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planilla-${planillaId}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function PlanillasPage() {
  const params = useParams<{ id: string }>();
  const { data: summary } = useSWR<ProjectSummary>(`/projects/${params.id}/summary`, apiGet);
  const {
    data: planillas,
    isLoading,
    mutate: mutatePlanillas,
  } = useSWR<Planilla[]>(`/planillas?projectId=${params.id}`, apiGet);
  const [showCreate, setShowCreate] = useState(false);

  async function handleDelete(planillaId: string, label: string) {
    if (
      !window.confirm(
        `¿Eliminar la planilla "${label}"?\n\nSe borrarán también sus ítems. No se puede deshacer.`,
      )
    )
      return;
    try {
      await apiDelete(`/planillas/${planillaId}`);
      mutatePlanillas();
    } catch (err) {
      window.alert(err instanceof ApiClientError ? err.message : 'No se pudo eliminar la planilla');
    }
  }

  return (
    <AppShell>
      <ProjectTabs projectId={params.id} />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium">
          Planillas de avance {summary ? `— ${summary.project.name}` : ''}
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          disabled={!summary}
          className="btn-primary disabled:opacity-50"
        >
          + Nueva planilla
        </button>
      </div>

      {summary && (
        <CreatePlanillaModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          projectId={params.id}
          rubros={summary.rubros}
          onCreated={() => mutatePlanillas()}
        />
      )}

      <p className="mb-4 text-xs text-ink-secondary">
        El sistema genera el Excel con el formato de las planillas de cobro
      </p>

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

      {planillas && planillas.length === 0 && (
        <div className="card text-sm text-ink-secondary">Aún no hay planillas para este proyecto.</div>
      )}

      <div className="space-y-3">
        {planillas?.map((p) => (
          <article key={p.id} className="card">
            <header className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">
                  Planilla #{p.number} — {p.title}
                </div>
                <div className="text-xs text-ink-secondary">
                  Período: {formatDate(p.periodStart)} — {formatDate(p.periodEnd)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={STATUS_CLASS[p.status]}>{STATUS_LABEL[p.status]}</span>
                <button onClick={() => downloadExcel(p.id)} className="btn-success">
                  Exportar Excel
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id, `Planilla #${p.number} — ${p.title}`)}
                  className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
                  title="Eliminar planilla"
                >
                  🗑️
                </button>
              </div>
            </header>

            <dl className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
              <Row label="A. Valor de planilla" value={formatCurrency(Number(p.totalCurrent), true)} />
              <Row
                label="B. Amortización anticipo"
                value={`-${formatCurrency(Number(p.advanceAmortization), true)}`}
              />
              <Row
                label="C. Fondo garantía"
                value={`-${formatCurrency(Number(p.guaranteeRetention), true)}`}
              />
              <Row label="Planilla anterior" value={formatCurrency(Number(p.totalPrevious), true)} />
              <Row label="Acumulado" value={formatCurrency(Number(p.totalAccumulated), true)} />
              <Row
                label="Total a pagar"
                value={formatCurrency(Number(p.netPayable), true)}
                emphasis
              />
            </dl>
          </article>
        ))}
      </div>
    </AppShell>
  );
}

function Row({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-border py-1">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className={emphasis ? 'font-medium text-success' : ''}>{value}</dd>
    </div>
  );
}
