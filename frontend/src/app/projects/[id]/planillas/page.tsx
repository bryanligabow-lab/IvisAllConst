'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layouts/AppShell';
import { ProjectTabs } from '@/components/layouts/ProjectTabs';
import { CreatePlanillaModal } from '@/components/forms/CreatePlanillaModal';
import { ChangePlanillaStatusModal } from '@/components/forms/ChangePlanillaStatusModal';
import { apiDelete, apiGet } from '@/lib/api';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { formatCurrency, formatCalendarDate } from '@/lib/format';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import {
  PLANILLA_STATUS_FLOW,
  PLANILLA_STATUS_LABEL,
  PLANILLA_STATUS_CLASS,
  planillaProgress,
} from '@/lib/planillaStatus';
import { useAuthStore } from '@/stores/authStore';
import type { Planilla, ProjectSummary } from '@/types';

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
  const { isRestricted, can } = useAuthStore();
  const percentOnly = isRestricted();
  const canWrite = can('planillas.write');
  const canExport = can('planillas.export');
  const canStatus = can('planillas.status');
  const contractAmount = Number(summary?.project.contractAmount ?? 0);
  const [showCreate, setShowCreate] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Planilla | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);

  return (
    <AppShell>
      <ProjectTabs projectId={params.id} />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium">
          Planillas de avance {summary ? `— ${summary.project.name}` : ''}
        </h1>
        {canWrite && (
          <button
            onClick={() => setShowCreate(true)}
            disabled={!summary}
            className="btn-primary disabled:opacity-50"
          >
            + Nueva planilla
          </button>
        )}
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
                  Período: {formatCalendarDate(p.periodStart)} — {formatCalendarDate(p.periodEnd)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canStatus ? (
                  <button
                    type="button"
                    onClick={() => setStatusTarget(p)}
                    className={`${PLANILLA_STATUS_CLASS[p.status]} cursor-pointer transition-opacity hover:opacity-75`}
                    title="Actualizar en qué paso va el cobro"
                  >
                    {PLANILLA_STATUS_LABEL[p.status]} ✎
                  </button>
                ) : (
                  <span className={PLANILLA_STATUS_CLASS[p.status]}>
                    {PLANILLA_STATUS_LABEL[p.status]}
                  </span>
                )}
                {canExport && (
                  <button onClick={() => downloadExcel(p.id)} className="btn-success">
                    Exportar Excel
                  </button>
                )}
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => setPendingDelete({ id: p.id, label: `Planilla #${p.number} — ${p.title}` })}
                    className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
                    title="Eliminar planilla"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </header>

            {/* Barra de progreso del cobro de la planilla */}
            {(() => {
              const prog = planillaProgress(p.status);
              const barColor =
                prog.tone === 'success'
                  ? 'bg-success'
                  : prog.tone === 'danger'
                    ? 'bg-danger'
                    : 'bg-brand';
              return (
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-ink-secondary">Progreso del cobro</span>
                    <span className="font-semibold text-ink-primary">
                      {prog.label} · {prog.pct}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className={`h-full rounded-full ${barColor} transition-all`}
                      style={{ width: `${prog.pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {percentOnly ? (
              (() => {
                const pct =
                  contractAmount > 0
                    ? Math.round((Number(p.totalAccumulated) / contractAmount) * 100)
                    : 0;
                return (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-ink-secondary">Avance acumulado</span>
                      <span className="font-semibold text-ink-primary">{pct}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })()
            ) : (
              <dl className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
                <Row label="Valor de planilla (base)" value={formatCurrency(Number(p.totalCurrent), true)} />
                <Row label="IVA" value={`+${formatCurrency(Number(p.ivaAmount ?? 0), true)}`} />
                <Row
                  label="Subtotal con IVA"
                  value={formatCurrency(Number(p.totalCurrent) + Number(p.ivaAmount ?? 0), true)}
                />
                <Row
                  label="Retención IVA"
                  value={`-${formatCurrency(Number(p.ivaRetention ?? 0), true)}`}
                />
                <Row
                  label="Retención renta"
                  value={`-${formatCurrency(Number(p.incomeRetention ?? 0), true)}`}
                />
                <Row
                  label="Amortización anticipo"
                  value={`-${formatCurrency(Number(p.advanceAmortization), true)}`}
                />
                {Number(p.advancePlanillaAmort ?? 0) > 0 && (
                  <Row
                    label="Anticipo planilla"
                    value={`-${formatCurrency(Number(p.advancePlanillaAmort), true)}`}
                  />
                )}
                <Row
                  label="Fondo garantía"
                  value={`-${formatCurrency(Number(p.guaranteeRetention), true)}`}
                />
                {Number(p.otherDiscount ?? 0) > 0 && (
                  <Row
                    label="Otros descuentos"
                    value={`-${formatCurrency(Number(p.otherDiscount), true)}`}
                  />
                )}
                <Row label="Planilla anterior" value={formatCurrency(Number(p.totalPrevious), true)} />
                <Row label="Acumulado (base)" value={formatCurrency(Number(p.totalAccumulated), true)} />
                <Row
                  label="Total a pagar (neto)"
                  value={formatCurrency(Number(p.netPayable), true)}
                  emphasis
                />
              </dl>
            )}

            {/* Seguimiento del cobro: en qué paso del proceso está la planilla */}
            {p.status !== 'CANCELLED' && (
              <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
                {PLANILLA_STATUS_FLOW.map((s, idx) => {
                  const currentIdx = PLANILLA_STATUS_FLOW.indexOf(p.status);
                  const reached = idx <= currentIdx;
                  return (
                    <div key={s} className="flex shrink-0 items-center gap-1">
                      {idx > 0 && (
                        <div
                          className={`h-px w-3 ${reached ? 'bg-brand' : 'bg-surface-border'}`}
                        />
                      )}
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] ${
                          idx === currentIdx
                            ? 'bg-brand font-semibold text-white'
                            : reached
                              ? 'bg-brand/15 text-brand'
                              : 'bg-surface-muted text-ink-tertiary'
                        }`}
                      >
                        {PLANILLA_STATUS_LABEL[s]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Historial: quién movió la planilla, cuándo y con qué nota */}
            {p.statusEvents && p.statusEvents.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-ink-tertiary hover:text-ink-secondary">
                  Historial de seguimiento ({p.statusEvents.length})
                </summary>
                <ul className="mt-1.5 space-y-1 border-l border-surface-border pl-3">
                  {p.statusEvents.map((ev) => (
                    <li key={ev.id} className="text-[11px] text-ink-secondary">
                      <span className="font-medium text-ink-primary">
                        {PLANILLA_STATUS_LABEL[ev.status]}
                      </span>{' '}
                      · {formatCalendarDate(ev.createdAt)}
                      {ev.creator
                        ? ` · ${ev.creator.firstName} ${ev.creator.lastName}`
                        : ''}
                      {ev.note && <div className="italic text-ink-tertiary">“{ev.note}”</div>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))}
      </div>

      <ChangePlanillaStatusModal
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        planilla={statusTarget}
        onSaved={() => mutatePlanillas()}
      />

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        itemLabel={pendingDelete ? `la planilla "${pendingDelete.label}"` : ''}
        warning="Se borrarán también todos sus ítems."
        onConfirm={async (code) => {
          if (!pendingDelete) return;
          await apiDelete(`/planillas/${pendingDelete.id}`, { deleteCode: code });
          await mutatePlanillas();
          setPendingDelete(null);
        }}
      />
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
