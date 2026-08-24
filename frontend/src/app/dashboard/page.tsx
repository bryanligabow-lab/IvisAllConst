'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/layouts/AppShell';
import { CreateProjectModal } from '@/components/forms/CreateProjectModal';
import { apiGet } from '@/lib/api';
import { ROUTES } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';

interface HomeSummary {
  proyectos: { activos: number; total: number };
  proformas: { pendientes: number; total: number };
  planillas: { porRevisar: number };
  cheques: { pendientes: number; esteMes: number };
  proveedores: { total: number };
  subcontratistas: { total: number };
  nomina: { empleados: number };
}

function saludo(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * Inicio de la app: un acceso por área, con una línea que explica qué se hace
 * ahí y un dato al pie. Cada tarjeta se muestra según los permisos del usuario,
 * así los jefes ven solo lo suyo (proyectos, subcontratistas, proformas, cheques).
 */
export default function InicioPage() {
  const { user, can, isRestricted } = useAuthStore();
  const { data } = useSWR<HomeSummary>('/home/summary', apiGet);
  const [showProyecto, setShowProyecto] = useState(false);
  const restringido = isRestricted();

  const nombre = user?.email?.split('@')[0] ?? '';

  const areas = [
    {
      show: can('proformas.read'),
      href: ROUTES.PROFORMAS,
      icon: '📄',
      title: 'Proformas',
      desc: 'Cotizaciones enviadas y su estado',
      pie: data ? `${data.proformas.pendientes} en borrador` : '',
    },
    {
      show: can('planillas.read') && !restringido,
      href: ROUTES.PLANILLAS,
      icon: '📋',
      title: 'Planillas',
      desc: 'Avances presentados para cobro',
      pie: data ? `${data.planillas.porRevisar} por cobrar` : '',
    },
    {
      show: can('cheques.read'),
      href: ROUTES.CHEQUES,
      icon: '🏦',
      title: 'Cheques',
      desc: 'Pagos emitidos y por emitir',
      pie: data ? `${data.cheques.pendientes} pendientes` : '',
    },
    {
      show: can('employees.read'),
      href: ROUTES.NOMINA,
      icon: '👷',
      title: 'Nómina',
      desc: 'Pago semanal del personal',
      pie: data ? `${data.nomina.empleados} empleados` : '',
    },
    {
      show: can('providers.read'),
      href: ROUTES.SUBCONTRATISTAS,
      icon: '🔧',
      title: 'Subcontratistas',
      desc: 'Contratos y pagos por avance',
      pie: data ? `${data.subcontratistas.total} registrados` : '',
    },
    {
      show: can('providers.read') && can('payment_orders.read'),
      href: ROUTES.PROVIDERS,
      icon: '🚚',
      title: 'Proveedores',
      desc: 'Órdenes de compra y saldos',
      pie: data ? `${data.proveedores.total} registrados` : '',
    },
  ].filter((a) => a.show);

  return (
    <AppShell>
      {/* Saludo */}
      <div className="mb-4">
        <div className="text-xs text-ink-tertiary">
          {saludo()}
          {nombre ? `, ${nombre}` : ''}
        </div>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight">
          ¿Qué vas a hacer hoy?
        </h1>
      </div>

      {/* Acciones rápidas */}
      {(can('projects.create') || can('proformas.write')) && (
        <div className="mb-5 grid grid-cols-2 gap-2">
          {can('projects.create') && (
            <button
              onClick={() => setShowProyecto(true)}
              className="rounded-2xl bg-brand p-3.5 text-left text-white"
            >
              <div className="text-sm font-semibold">+ Nuevo proyecto</div>
              <div className="text-[11px] text-white/75">Empieza una obra</div>
            </button>
          )}
          {can('proformas.write') && (
            <Link
              href={ROUTES.PROFORMAS}
              className="rounded-2xl border border-surface-border bg-surface p-3.5"
            >
              <div className="text-sm font-semibold text-ink-primary">+ Proforma</div>
              <div className="text-[11px] text-ink-tertiary">Cotiza a un cliente</div>
            </Link>
          )}
        </div>
      )}

      <div className="mb-2 font-mono text-[11px] uppercase tracking-[.14em] text-ink-tertiary">
        Áreas
      </div>

      {/* Proyectos: tarjeta ancha */}
      {can('projects.read') && (
        <Link
          href={ROUTES.PROYECTOS_REPORT}
          className="mb-2.5 flex items-center gap-3.5 rounded-2xl border border-surface-border bg-surface p-4 transition-colors hover:border-brand/50"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-lg">
            🏗️
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[17px] font-semibold text-ink-primary">Proyectos</span>
              {data && (
                <span className="text-xs font-semibold text-brand">
                  {data.proyectos.activos} {restringido ? 'asignados' : 'activos'}
                </span>
              )}
            </div>
            <div className="text-xs leading-snug text-ink-tertiary">
              Obras en curso, presupuesto y avance de cada una
            </div>
          </div>
          <span className="shrink-0 text-lg text-ink-tertiary">›</span>
        </Link>
      )}

      {/* Resto de áreas en rejilla de 2 */}
      <div className="grid grid-cols-2 gap-2.5">
        {areas.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex min-h-[132px] flex-col gap-2.5 rounded-2xl border border-surface-border bg-surface p-3.5 transition-colors hover:border-brand/50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-muted text-base">
              {a.icon}
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-semibold text-ink-primary">{a.title}</div>
              <div className="text-[11px] leading-snug text-ink-tertiary">{a.desc}</div>
            </div>
            {a.pie && <div className="text-[11px] text-ink-tertiary">{a.pie}</div>}
          </Link>
        ))}
      </div>

      <CreateProjectModal
        open={showProyecto}
        onClose={() => setShowProyecto(false)}
        onSaved={() => setShowProyecto(false)}
      />
    </AppShell>
  );
}
