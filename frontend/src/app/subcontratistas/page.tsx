'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { AppShell } from '@/components/layouts/AppShell';
import { apiGet } from '@/lib/api';
import { ROUTES } from '@/lib/constants';
import { formatCurrency } from '@/lib/format';
import type { SubcontractorView } from '@/types';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  PAUSED: 'Pausado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

export default function SubcontratistasPage() {
  const { data, isLoading } = useSWR<SubcontractorView[]>(
    '/projects/subcontractors',
    apiGet,
  );
  const [selected, setSelected] = useState<string | null>(null);

  const list = data ?? [];
  const active = selected
    ? list.find((s) => s.id === selected) ?? null
    : list[0] ?? null;

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Subcontratistas</h1>
        <p className="text-xs text-ink-secondary">
          Obras ejecutadas por terceros. Selecciona un subcontratista para ver sus
          proyectos y el avance de cada obra.
        </p>
      </div>

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

      {!isLoading && list.length === 0 && (
        <div className="rounded-md border border-dashed border-surface-border bg-surface-muted/40 p-6 text-center text-sm text-ink-secondary">
          Aún no hay proyectos subcontratados. Marca un proyecto como{' '}
          <strong>Subcontratada</strong> y asígnale un subcontratista al crearlo o editarlo.
        </div>
      )}

      {list.length > 0 && (
        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          {/* Lista de subcontratistas */}
          <div className="space-y-2">
            {list.map((s) => {
              const isActive = active?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-all ${
                    isActive
                      ? 'border-brand/60 bg-brand-light shadow-soft'
                      : 'border-surface-border bg-surface hover:border-brand/40'
                  }`}
                >
                  <div className="text-sm font-semibold text-ink-primary">{s.name}</div>
                  <div className="text-[11px] text-ink-secondary">
                    {s.projects.length} obra{s.projects.length === 1 ? '' : 's'}
                    {s.ruc ? ` · RUC ${s.ruc}` : ''}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detalle del subcontratista seleccionado */}
          {active && (
            <div className="rounded-lg border border-surface-border bg-surface p-4 shadow-soft">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-ink-primary">{active.name}</h2>
                  <div className="text-[11px] text-ink-secondary">
                    {active.phone ? `📞 ${active.phone}` : ''}
                    {active.email ? `  ✉️ ${active.email}` : ''}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {active.projects.map((p) => {
                  const pct = Math.round(p.progressBudget * 100);
                  const isOver = p.budgeted > 0 && p.spent > p.budgeted;
                  return (
                    <Link
                      key={p.id}
                      href={ROUTES.PROJECT_BUDGET(p.id)}
                      className="block rounded-lg border border-surface-border bg-surface p-3 transition-all hover:border-brand/60 hover:shadow-card"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink-primary">
                            {p.name}
                          </div>
                          <div className="truncate text-[11px] text-ink-secondary">{p.code}</div>
                        </div>
                        <span className="badge-muted shrink-0">{STATUS_LABEL[p.status] ?? p.status}</span>
                      </div>

                      <div className="mt-2">
                        <div className="mb-0.5 flex justify-between text-[10px] text-ink-secondary">
                          <span>Avance vs presupuesto</span>
                          <span className={`font-semibold ${isOver ? 'text-danger' : 'text-ink-primary'}`}>
                            {p.budgeted > 0 ? `${pct}%` : '—'}
                            {isOver ? ' · Excedido' : ''}
                          </span>
                        </div>
                        <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-muted">
                          <div
                            className={`h-full transition-all ${
                              isOver
                                ? 'bg-danger'
                                : pct > 85
                                  ? 'bg-warning'
                                  : 'bg-gradient-to-r from-brand to-brand-accent'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-2 flex justify-between text-[11px]">
                        <span className="text-ink-tertiary">
                          Presupuesto <span className="font-medium text-ink-primary">{formatCurrency(p.budgeted)}</span>
                        </span>
                        <span className="text-ink-tertiary">
                          Ejecutado <span className="font-medium text-ink-primary">{formatCurrency(p.spent)}</span>
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
