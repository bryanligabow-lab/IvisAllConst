'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { apiPost, setAccessToken } from '@/lib/api';
import { ROUTES } from '@/lib/constants';

const NAV_LINKS = [
  { href: ROUTES.DASHBOARD, label: 'Proyectos' },
  { href: ROUTES.PROVIDERS, label: 'Proveedores' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, loadMe, setUser } = useAuthStore();

  useEffect(() => {
    if (!user) void loadMe();
  }, [user, loadMe]);

  useEffect(() => {
    if (!loading && !user) router.replace(ROUTES.LOGIN);
  }, [loading, user, router]);

  const handleLogout = async () => {
    try {
      await apiPost('/auth/logout', {});
    } catch {
      /* ignorar */
    }
    setAccessToken(null);
    setUser(null);
    router.replace(ROUTES.LOGIN);
  };

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center text-ink-secondary">
        Cargando…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <Link href={ROUTES.DASHBOARD} className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-brand text-sm font-semibold text-white">
              CP
            </div>
            <div>
              <div className="text-base font-medium">Control de proyectos</div>
              <div className="text-xs text-ink-secondary">Sistema de gestión de obra</div>
            </div>
          </Link>

          <nav className="hidden flex-1 justify-center gap-1 md:flex">
            {NAV_LINKS.map((l) => {
              const active =
                l.href === ROUTES.DASHBOARD
                  ? pathname.startsWith('/dashboard') || pathname.startsWith('/projects')
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? 'bg-brand-light text-brand font-medium'
                      : 'text-ink-secondary hover:bg-surface-muted hover:text-ink-primary'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs sm:block">
              <div className="font-medium">{user.email}</div>
              <div className="text-ink-secondary">{user.roles.join(', ')}</div>
            </div>
            <button onClick={handleLogout} className="btn-secondary">
              Salir
            </button>
          </div>
        </div>

        {/* Mobile nav strip */}
        <nav className="flex gap-1 overflow-x-auto border-t border-surface-border px-4 py-2 md:hidden">
          {NAV_LINKS.map((l) => {
            const active =
              l.href === ROUTES.DASHBOARD
                ? pathname.startsWith('/dashboard') || pathname.startsWith('/projects')
                : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? 'bg-brand-light text-brand font-medium'
                    : 'text-ink-secondary hover:bg-surface-muted hover:text-ink-primary'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
