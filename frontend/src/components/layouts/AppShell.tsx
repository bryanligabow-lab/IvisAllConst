'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { apiPost, clearSession } from '@/lib/api';
import { ROUTES } from '@/lib/constants';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SessionExpiryWatcher } from '@/components/ui/SessionExpiryWatcher';

interface NavLink {
  href: string;
  label: string;
  perm: string;
  // Visible solo para roles sin restricción por proyecto (oculta reportes
  // globales en dinero a operadores).
  unrestrictedOnly?: boolean;
}

const NAV_LINKS: NavLink[] = [
  { href: ROUTES.DASHBOARD, label: 'Inicio', perm: 'projects.read' },
  { href: ROUTES.PROYECTOS_REPORT, label: 'Proyectos', perm: 'projects.read', unrestrictedOnly: true },
  { href: ROUTES.PROVIDERS, label: 'Proveedores', perm: 'providers.read' },
  { href: ROUTES.SUBCONTRATISTAS, label: 'Subcontratistas', perm: 'providers.read', unrestrictedOnly: true },
  { href: ROUTES.PLANILLAS, label: 'Planillas', perm: 'ingresos.read', unrestrictedOnly: true },
  { href: ROUTES.CLIENTES, label: 'Clientes', perm: 'clients.read' },
  { href: ROUTES.NOMINA, label: 'Nómina', perm: 'employees.read' },
  { href: ROUTES.PROFORMAS, label: 'Proformas', perm: 'proformas.read' },
  { href: ROUTES.DIRECTORIO, label: 'Directorio', perm: 'users.read' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, loadMe, setUser, can, isRestricted } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user) void loadMe();
  }, [user, loadMe]);

  useEffect(() => {
    if (!loading && !user) router.replace(ROUTES.LOGIN);
  }, [loading, user, router]);

  // Cerrar el drawer al navegar.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await apiPost('/auth/logout', {});
    } catch {
      /* ignorar */
    }
    clearSession();
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

  const restricted = isRestricted();
  const links = NAV_LINKS.filter(
    (l) => can(l.perm) && (!l.unrestrictedOnly || !restricted),
  );

  const isActive = (href: string) =>
    href === ROUTES.DASHBOARD
      ? pathname === '/dashboard' || pathname.startsWith('/projects/')
      : pathname.startsWith(href);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-surface-border bg-surface/80 backdrop-blur-md">
        {/* Acento de marca arriba */}
        <div className="h-0.5 header-accent" />

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            {/* Botón hamburguesa (solo móvil) */}
            <button
              type="button"
              aria-label="Abrir menú"
              onClick={() => setMobileOpen(true)}
              className="-ml-1 inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-secondary hover:bg-surface-muted md:hidden"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

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
          </div>

          <nav className="hidden flex-1 justify-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-4 py-2 text-sm transition-all ${
                  isActive(l.href)
                    ? 'bg-brand-light text-brand font-semibold shadow-soft'
                    : 'text-ink-secondary hover:bg-surface-muted hover:text-ink-primary'
                }`}
              >
                {l.label}
              </Link>
            ))}
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
      </header>

      {/* Drawer móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[80%] border-r border-surface-border bg-surface p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-primary">Menú</span>
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary hover:bg-surface-muted"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="mb-4 rounded-lg bg-surface-muted px-3 py-2 text-xs">
              <div className="font-medium text-ink-primary">{user.email}</div>
              <div className="text-ink-secondary">{user.roles.join(', ')}</div>
            </div>
            <nav className="flex flex-col gap-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-md px-3 py-2.5 text-sm transition-colors ${
                    isActive(l.href)
                      ? 'bg-brand-light text-brand font-semibold'
                      : 'text-ink-secondary hover:bg-surface-muted hover:text-ink-primary'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 animate-fade-in sm:px-6 sm:py-8">{children}</main>

      <SessionExpiryWatcher onLogout={handleLogout} />
    </div>
  );
}
