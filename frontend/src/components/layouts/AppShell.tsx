'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { apiPost, setAccessToken } from '@/lib/api';
import { ROUTES } from '@/lib/constants';

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-brand text-sm font-semibold text-white">
              CP
            </div>
            <div>
              <div className="text-base font-medium">Control de proyectos</div>
              <div className="text-xs text-ink-secondary">Sistema de gestión de obra</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right text-xs">
              <div className="font-medium">{user.email}</div>
              <div className="text-ink-secondary">{user.roles.join(', ')}</div>
            </div>
            <button onClick={handleLogout} className="btn-secondary">
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
