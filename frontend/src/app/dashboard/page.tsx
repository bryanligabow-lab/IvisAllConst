'use client';

import { AppShell } from '@/components/layouts/AppShell';
import { DashboardEscritorio } from '@/components/dashboard/DashboardEscritorio';
import { InicioMovil } from '@/components/dashboard/InicioMovil';
import { useIsMobile } from '@/lib/useIsMobile';

/**
 * Inicio. En el celular muestra el acceso por áreas (simple, sin mapa); en la
 * computadora se mantiene el dashboard completo de siempre (mapa, KPIs,
 * lista de proyectos y planillas pendientes).
 */
export default function InicioPage() {
  const isMobile = useIsMobile();

  return (
    <AppShell>
      {isMobile === null ? (
        <div className="py-8 text-sm text-ink-secondary">Cargando…</div>
      ) : isMobile ? (
        <InicioMovil />
      ) : (
        <DashboardEscritorio />
      )}
    </AppShell>
  );
}
