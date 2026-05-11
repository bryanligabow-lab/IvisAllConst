'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost, setAccessToken } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/lib/constants';

interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  userId: string;
}

export default function LoginPage() {
  const router = useRouter();
  const loadMe = useAuthStore((s) => s.loadMe);
  const [email, setEmail] = useState('admin@ivisallconst.local');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiPost<LoginResponse>('/auth/login', { email, password });
      setAccessToken(data.accessToken);
      await loadMe();
      router.replace(ROUTES.DASHBOARD);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-surface-muted px-4">
      <div className="w-full max-w-sm card">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-brand text-sm font-semibold text-white">
            CP
          </div>
          <div>
            <div className="text-lg font-medium">Control de proyectos</div>
            <div className="text-xs text-ink-secondary">IvisAllConst</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-secondary">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-surface-border px-3 py-2 text-sm outline-none focus:border-brand"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-secondary">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-surface-border px-3 py-2 text-sm outline-none focus:border-brand"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
