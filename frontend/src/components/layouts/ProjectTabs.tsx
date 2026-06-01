'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';

interface ProjectTabsProps {
  projectId: string;
}

export function ProjectTabs({ projectId }: ProjectTabsProps) {
  const pathname = usePathname();
  const { can } = useAuthStore();

  const tabs = [
    { href: ROUTES.PROJECT_BUDGET(projectId), label: 'Presupuesto', perm: 'rubros.read' },
    { href: ROUTES.PROJECT_EXPENSES(projectId), label: 'Gastos', perm: 'gastos.read' },
    { href: ROUTES.PROJECT_ORDERS(projectId), label: 'Órdenes de pago', perm: 'payment_orders.read' },
    { href: ROUTES.PROJECT_PROVIDERS(projectId), label: 'Proveedores', perm: 'providers.read' },
    { href: ROUTES.PROJECT_PLANILLAS(projectId), label: 'Planillas', perm: 'planillas.read' },
    { href: ROUTES.PROJECT_BITACORA(projectId), label: 'Bitácora', perm: 'bitacora.read' },
    { href: ROUTES.PROJECT_DOCUMENTS(projectId), label: 'Documentación', perm: 'projects.read' },
  ].filter((t) => can(t.perm));

  return (
    <nav className="mb-5 flex gap-0 border-b border-surface-border overflow-x-auto">
      <Link href={ROUTES.DASHBOARD} className="tab">
        ← Volver
      </Link>
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`tab ${pathname === t.href ? 'tab-active' : ''}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
