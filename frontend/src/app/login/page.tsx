'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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
    <div
      className="relative grid min-h-screen place-items-center px-4"
      style={{
        background:
          'radial-gradient(ellipse at top, #FFFFFF 0%, #F7F5F2 50%, #EDE9E3 100%)',
      }}
    >
      {/* Acento decorativo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-ink-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="mb-6 flex justify-center">
          <Image
            src="/logo-creacom.png"
            alt="CREACOM"
            width={240}
            height={150}
            priority
            className="h-auto w-[200px] drop-shadow-[0_4px_16px_rgba(199,62,44,0.12)]"
          />
        </div>

        <div className="rounded-xl border border-surface-border bg-surface p-7 shadow-premium">
          <div className="mb-5 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-ink-primary">
              Bienvenido de nuevo
            </h1>
            <p className="mt-1 text-xs text-ink-secondary">
              Inicia sesión para gestionar tus proyectos
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-secondary">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-secondary">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full justify-center py-2.5 text-base"
            >
              {submitting ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
          Sistema de gestión de obra · CREACOM
        </p>
      </div>
    </div>
  );
}
