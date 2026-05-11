'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { apiPost, setAccessToken } from '@/lib/api';
import { ROUTES } from '@/lib/constants';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const NAV_LINKS = [
  { href: ROUTES.DASHBOARD, label: 'Proyectos' },
  { href: ROUTES.PROVIDERS, label: 'Proveedores' },
  { href: ROUTES.NOMINA, label: 'Nómina' },
  { href: ROUTES.PROFORMAS, label: 'Proformas' },
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
      <header className="sticky top-0 z-30 border-b border-surface-border bg-surface/80 backdrop-blur-md">
        {/* Acento de marca arriba */}
        <div className="h-0.5 header-accent" />

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <Link href={ROUTES.DASHBOARD} className="flex items-center gap-3 group">
            <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-white p-0.5 shadow-soft transition-transform group-hover:scale-105">
              <Image
                src="/logo-creacom.png"
                alt="CREACOM"
                width={80}
                height={80}
                priority
                className="h-full w-full object-contain"
              />
            </div>
            <div className="hidden sm:block">
              <div className="text-base font-semibold tracking-tight text-ink-primary">
                CREACOM
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-secondary">
                Innovación · Proyectos · Servicios
              </div>
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
                  className={`rounded-md px-4 py-2 text-sm transition-all ${
                    active
                      ? 'bg-brand-light text-brand font-semibold shadow-soft'
                      : 'text-ink-secondary hover:bg-surface-muted hover:text-ink-primary'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden text-right text-xs sm:block">
              <div className="font-medium text-ink-primary">{user.email}</div>
              <div className="text-ink-secondary">{user.roles.join(', ')}</div>
            </div>
            <ThemeToggle />
            <button onClick={handleLogout} className="btn-secondary">
              Salir
            </button>
          </div>
        </div>

        {/* Mobile nav */}
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
                    ? 'bg-brand-light text-brand font-semibold'
                    : 'text-ink-secondary hover:bg-surface-muted hover:text-ink-primary'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 animate-fade-in">{children}</main>
    </div>
  );
}
