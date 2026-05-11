'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/constants';

interface ProjectTabsProps {
  projectId: string;
}

export function ProjectTabs({ projectId }: ProjectTabsProps) {
  const pathname = usePathname();
  const tabs = [
    { href: ROUTES.PROJECT_BUDGET(projectId), label: 'Presupuesto' },
    { href: ROUTES.PROJECT_EXPENSES(projectId), label: 'Gastos' },
    { href: ROUTES.PROJECT_PLANILLAS(projectId), label: 'Planillas' },
  ];

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
