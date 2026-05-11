'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

const SHOWN_KEY = 'creacom.welcome-shown';

export function WelcomePreloader() {
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<'enter' | 'leave'>('enter');

  useEffect(() => {
    // Mostrar solo si la pestaña aún no lo vio en esta sesión.
    if (typeof window === 'undefined') return;
    const already = sessionStorage.getItem(SHOWN_KEY);
    if (already) return;
    setShow(true);
    sessionStorage.setItem(SHOWN_KEY, '1');

    const t1 = setTimeout(() => setPhase('leave'), 2200);
    const t2 = setTimeout(() => setShow(false), 2700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!show) return null;

  // detectar dark mode para que el preloader respete el tema
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');
  const bg = isDark
    ? 'radial-gradient(ellipse at center, #15151A 0%, #0F0F12 60%, #08080B 100%)'
    : 'radial-gradient(ellipse at center, #FFFFFF 0%, #F7F5F2 60%, #EDE9E3 100%)';

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-500 ${
        phase === 'leave' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ background: bg }}
    >
      {/* Acento de marca arriba */}
      <div className="absolute top-0 left-0 right-0 h-1 header-accent" />

      <div className="flex flex-col items-center px-6">
        <div className="animate-logo-pop">
          <Image
            src="/logo-creacom.png"
            alt="CREACOM"
            width={320}
            height={200}
            priority
            className="h-auto w-[280px] drop-shadow-[0_8px_24px_rgba(199,62,44,0.15)] md:w-[340px]"
          />
        </div>

        <div className="mt-6 text-center animate-fade-in-up-delayed">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-primary md:text-3xl">
            Bienvenidos
          </h1>
          <p className="mt-1.5 text-sm text-ink-secondary md:text-base">
            Sistema de gestión de obra · Innovación · Proyectos · Servicios
          </p>
        </div>

        {/* Barra de progreso animada */}
        <div className="mt-8 h-1 w-48 overflow-hidden rounded-full bg-surface-border/60">
          <div
            className="h-full origin-left bg-gradient-to-r from-brand to-brand-accent animate-bar-fill"
          />
        </div>
      </div>

      {/* Marca de agua sutil abajo */}
      <div className="absolute bottom-6 text-[10px] uppercase tracking-[0.2em] text-ink-tertiary animate-fade-in">
        Creacom · Construcciones
      </div>
    </div>
  );
}
