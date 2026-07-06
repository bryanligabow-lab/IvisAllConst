'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layouts/AppShell';
import { ProjectTabs } from '@/components/layouts/ProjectTabs';
import { CreateIngresoModal } from '@/components/forms/CreateIngresoModal';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { apiDelete, apiGet } from '@/lib/api';
import { formatCurrency, formatCalendarDate } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type { Ingreso, IngresoKind, IngresosSummary, Planilla } from '@/types';

const KIND_LABEL: Record<IngresoKind, string> = {
  ANTICIPO: 'Anticipo',
  PLANILLA: 'Pago de planilla',
  OTRO: 'Otro',
};

const KIND_CLASS: Record<IngresoKind, string> = {
  ANTICIPO: 'badge-warn',
  PLANILLA: 'badge-ok',
  OTRO: 'badge-muted',
};

export default function IngresosPage() {
  const params = useParams<{ id: string }>();
  const { data: summary, mutate: mutateSummary } = useSWR<IngresosSummary>(
    `/ingresos/summary?projectId=${params.id}`,
    apiGet,
  );
  const {
    data: ingresos,
    isLoading,
    mutate: mutateIngresos,
  } = useSWR<Ingreso[]>(`/ingresos?projectId=${params.id}`, apiGet);
  const { data: planillas } = useSWR<Planilla[]>(`/planillas?projectId=${params.id}`, apiGet);
  const { can } = useAuthStore();
  const canWrite = can('ingresos.write');

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Ingreso | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);

  const refresh = () => {
    void mutateIngresos();
    void mutateSummary();
  };

  return (
    <AppShell>
      <ProjectTabs projectId={params.id} />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium">
          Ingresos {summary ? `— ${summary.project.name}` : ''}
        </h1>
        {canWrite && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            + Registrar ingreso
          </button>
        )}
      </div>

      <p className="mb-4 text-xs text-ink-secondary">
        Anticipos y cobros del proyecto: cuánto nos han pagado y cuánto falta por cobrar
      </p>

      {summary && (
        <>
          {/* Resumen del cobro */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryCard
              label="Contrato"
              value={formatCurrency(summary.project.contractAmount)}
              hint={
                summary.project.managesAdvance
                  ? `Anticipo pactado: ${summary.project.advancePercent}% (${formatCurrency(summary.project.advanceExpected, true)})`
                  : 'Sin anticipo'
              }
            />
            <SummaryCard
              label="Total ingresado"
              value={formatCurrency(summary.ingresos.total)}
              hint={`Anticipos ${formatCurrency(summary.ingresos.anticipos, true)} · Planillas ${formatCurrency(summary.ingresos.planillas, true)}`}
              tone="success"
            />
            <SummaryCard
              label="Por cobrar"
              value={formatCurrency(summary.planillas.porCobrar)}
              hint="Planillas presentadas aún no pagadas"
              tone={summary.planillas.porCobrar > 0 ? 'warn' : 'default'}
            />
            {summary.project.managesAdvance ? (
              <SummaryCard
                label="Anticipo por devengar"
                value={formatCurrency(summary.anticipo.saldoPorDevengar)}
                hint={`Recibido ${formatCurrency(summary.anticipo.recibido, true)} · Devengado ${formatCurrency(summary.anticipo.devengado, true)}`}
                tone={summary.anticipo.saldoPorDevengar > 0 ? 'warn' : 'default'}
              />
            ) : (
              <SummaryCard
                label="Facturado"
                value={formatCurrency(summary.planillas.facturado)}
                hint="Planillas aprobadas o pagadas"
              />
            )}
          </div>

          {/* Estado de las planillas del proyecto */}
          <div className="card mb-4">
            <div className="mb-2 text-xs font-semibold text-ink-secondary">
              Planillas del proyecto
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
              <Stat label="Presentadas" value={String(summary.planillas.presentadas)} />
              <Stat label="Aprobadas" value={String(summary.planillas.aprobadas)} />
              <Stat label="Pagadas" value={String(summary.planillas.pagadas)} />
              <Stat
                label="Total planillado"
                value={formatCurrency(summary.planillas.totalPlanillado, true)}
              />
              <Stat
                label="Facturado"
                value={formatCurrency(summary.planillas.facturado, true)}
              />
            </div>
          </div>
        </>
      )}

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

      {ingresos && ingresos.length === 0 && (
        <div className="card text-sm text-ink-secondary">
          Aún no hay ingresos registrados para este proyecto.
        </div>
      )}

      <div className="space-y-2">
        {ingresos?.map((ing) => (
          <article key={ing.id} className="card flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={KIND_CLASS[ing.kind]}>{KIND_LABEL[ing.kind]}</span>
                <span className="text-sm font-semibold text-success">
                  {formatCurrency(Number(ing.amount))}
                </span>
                <span className="text-xs text-ink-secondary">
                  {formatCalendarDate(ing.ingresoDate)}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-ink-secondary">
                {ing.entity && <span>👤 {ing.entity}</span>}
                {ing.planilla && (
                  <span className="ml-2">
                    📋 Planilla #{ing.planilla.number} — {ing.planilla.title}
                  </span>
                )}
                {ing.invoiceNumber && <span className="ml-2">🧾 {ing.invoiceNumber}</span>}
                {ing.reference && <span className="ml-2">Ref: {ing.reference}</span>}
              </div>
              {ing.notes && (
                <div className="mt-0.5 text-[11px] italic text-ink-tertiary">{ing.notes}</div>
              )}
            </div>
            {canWrite && (
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(ing)}
                  className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-surface-muted hover:text-ink-primary"
                  title="Editar ingreso"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPendingDelete({
                      id: ing.id,
                      label: `${KIND_LABEL[ing.kind]} de ${formatCurrency(Number(ing.amount))}`,
                    })
                  }
                  className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
                  title="Eliminar ingreso"
                >
                  🗑️
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      <CreateIngresoModal
        open={showCreate || !!editing}
        onClose={() => {
          setShowCreate(false);
          setEditing(null);
        }}
        projectId={params.id}
        planillas={planillas ?? []}
        initial={editing}
        onSaved={refresh}
      />

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        itemLabel={pendingDelete ? `el ingreso "${pendingDelete.label}"` : ''}
        onConfirm={async (code) => {
          if (!pendingDelete) return;
          await apiDelete(`/ingresos/${pendingDelete.id}`, { deleteCode: code });
          refresh();
          setPendingDelete(null);
        }}
      />
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'success' | 'warn';
}) {
  const valueColour =
    tone === 'success' ? 'text-success' : tone === 'warn' ? 'text-warning' : 'text-ink-primary';
  return (
    <div className="metric-card">
      <div className="text-xs text-ink-secondary">{label}</div>
      <div className={`mt-1 text-lg font-semibold tracking-tight ${valueColour}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-ink-tertiary">{hint}</div>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-muted/50 px-2 py-1.5">
      <div className="text-[10px] text-ink-tertiary">{label}</div>
      <div className="font-semibold text-ink-primary">{value}</div>
    </div>
  );
}
