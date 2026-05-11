'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { apiPost, setAccessToken } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/lib/constants';
import {
  IllustrationPlanning,
  IllustrationBlueprint,
  IllustrationSite,
} from '@/components/ui/ConstructionIllustrations';

interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  userId: string;
}

// Ilustraciones flat-cartoon de construcción (SVG inline, paleta CREACOM)
const CAROUSEL_SLIDES = [
  {
    Illustration: IllustrationPlanning,
    title: 'Todos tus proyectos,',
    subtitle: 'en un solo lugar.',
    bullets: [
      'Planifica, ejecuta y da seguimiento a tus proyectos.',
      'Controla tiempos, costos y presupuestos en tiempo real.',
      'Colabora con tu equipo desde cualquier lugar.',
    ],
  },
  {
    Illustration: IllustrationBlueprint,
    title: 'Proveedores y nómina',
    subtitle: 'bajo control.',
    bullets: [
      'Registra órdenes con pagos parciales y método de pago.',
      'Gestiona empleados, salarios y pagos mensuales.',
      'Genera proformas profesionales en PDF y Excel.',
    ],
  },
  {
    Illustration: IllustrationSite,
    title: 'Vista global del país,',
    subtitle: 'detalle por proyecto.',
    bullets: [
      'KPIs y avance por obra en el dashboard.',
      'Mapa de Ecuador con cada proyecto geolocalizado.',
      'Modo oscuro y diseño optimizado para tu equipo.',
    ],
  },
];

export default function LoginPage() {
  const router = useRouter();
  const loadMe = useAuthStore((s) => s.loadMe);
  const [email, setEmail] = useState('admin@ivisallconst.local');
  const [password, setPassword] = useState('Admin123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [slide, setSlide] = useState(0);

  // Carrusel automático cada 6s
  useEffect(() => {
    const t = setInterval(() => {
      setSlide((s) => (s + 1) % CAROUSEL_SLIDES.length);
    }, 6000);
    return () => clearInterval(t);
  }, []);

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

  const active = CAROUSEL_SLIDES[slide];

  return (
    <div className="flex min-h-screen bg-[#3A0F0A]">
      {/* ============ Panel izquierdo (oscuro) ============ */}
      <aside className="relative hidden w-[44%] flex-col overflow-hidden p-10 text-white lg:flex">
        {/* Fondo con degradado */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(135deg, #2B0907 0%, #5D1810 45%, #8F2B1F 100%)',
          }}
        />
        {/* Patrón de puntos sutil */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Logo + label */}
        <div className="flex items-center gap-4">
          <div className="rounded-md bg-white/95 p-1.5">
            <Image
              src="/logo-creacom.png"
              alt="CREACOM"
              width={120}
              height={48}
              priority
              className="h-7 w-auto md:h-9"
            />
          </div>
          <span className="hidden h-7 w-px bg-white/30 md:block" />
          <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/85 md:text-xs">
            Gestión de proyectos
          </span>
        </div>

        {/* Ilustraciones SVG flat-cartoon (carrusel) */}
        <div className="relative my-6 flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.06] p-4 backdrop-blur-sm ring-1 ring-white/10">
          {CAROUSEL_SLIDES.map((s, idx) => {
            const Illustration = s.Illustration;
            return (
              <div
                key={idx}
                className={`absolute inset-4 flex items-center justify-center transition-opacity duration-700 ${
                  idx === slide ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden={idx !== slide}
              >
                <Illustration />
              </div>
            );
          })}
        </div>

        {/* Dots del carrusel */}
        <div className="mb-5 flex gap-1.5">
          {CAROUSEL_SLIDES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Ir al slide ${idx + 1}`}
              onClick={() => setSlide(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === slide ? 'w-8 bg-white' : 'w-4 bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>

        {/* Tarjeta de info */}
        <div className="rounded-2xl bg-white/[0.08] p-5 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10 text-2xl">
              🏗️
            </div>
            <div>
              <div className="text-lg font-semibold leading-tight">
                {active.title}
                <br />
                {active.subtitle}
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-white/85">
                {active.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-white/15">
                      <svg
                        viewBox="0 0 12 12"
                        fill="none"
                        className="h-2.5 w-2.5"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 6.5 L5 9 L10 3.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center gap-2 text-xs text-white/70">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
            ?
          </span>
          <span>
            ¿Tienes alguna duda? Visita nuestro{' '}
            <a
              href="mailto:soporte@creacom.local"
              className="font-medium text-white underline-offset-4 hover:underline"
            >
              Centro de ayuda
            </a>
          </span>
        </div>
      </aside>

      {/* ============ Panel derecho (formulario) ============ */}
      <main className="relative flex flex-1 items-center justify-center bg-surface p-6 lg:rounded-l-[36px]">
        {/* Logo superior — visible en todos los breakpoints, arriba del card */}
        <div className="absolute left-1/2 top-4 -translate-x-1/2 lg:top-8">
          <Image
            src="/logo-creacom.png"
            alt="CREACOM"
            width={360}
            height={144}
            priority
            className="h-24 w-auto drop-shadow-[0_6px_18px_rgba(199,62,44,0.2)] md:h-28 lg:h-32"
          />
        </div>

        <div className="mt-40 w-full max-w-md lg:mt-36">
          <div className="rounded-2xl border border-surface-border bg-surface p-8 shadow-premium">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-ink-primary">
                Iniciar sesión
              </h1>
              <p className="mt-1 text-sm text-ink-secondary">
                Accede a tu cuenta de CREACOM
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-primary">
                  Usuario
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-tertiary">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="Usuario"
                    className="input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-primary">
                  Contraseña
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-tertiary">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                    >
                      <rect x="4" y="11" width="16" height="10" rx="2" />
                      <path
                        d="M8 11V8a4 4 0 0 1 8 0v3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Contraseña"
                    className="input pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-tertiary hover:text-ink-primary"
                  >
                    {showPassword ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-5 w-5"
                      >
                        <path
                          d="M3 3l18 18M10.5 10.677a2 2 0 0 0 2.823 2.823M9.363 5.365A9.466 9.466 0 0 1 12 5c5 0 8.5 4 9.5 7-.412 1.236-1.392 2.79-2.85 4.144M6.13 6.13C4.4 7.36 3.25 9.05 2.5 12c1 3 4.5 7 9.5 7 1.74 0 3.32-.475 4.7-1.262"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-5 w-5"
                      >
                        <path
                          d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger animate-fade-in">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-brand py-2.5 text-base font-semibold text-white shadow-soft transition-all hover:bg-brand-dark hover:shadow-card active:scale-[0.99] disabled:opacity-50"
              >
                {submitting ? 'Entrando…' : 'Ingresar'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  className="text-xs font-medium text-brand hover:text-brand-dark hover:underline"
                  onClick={() =>
                    window.alert(
                      'Si tienes problemas para ingresar, contacta al administrador del sistema.',
                    )
                  }
                >
                  ¿Tienes problemas para ingresar?
                </button>
              </div>
            </form>
          </div>

          {/* Tarjeta de colaboradores */}
          <div className="mt-5 flex items-center gap-4 rounded-2xl border border-surface-border bg-surface p-5 shadow-soft">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-light text-2xl">
              🏗️
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-ink-primary">
                Acceso para colaboradores
              </div>
              <div className="mt-0.5 text-xs text-ink-secondary">
                Si eres parte de un proyecto, solicita acceso a tu administrador.
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                window.alert(
                  'Pídele al administrador del sistema que te cree una cuenta o asigne un rol.',
                )
              }
              className="shrink-0 text-xs font-semibold text-brand hover:text-brand-dark"
            >
              Solicita acceso →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
