'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import { ROUTES } from '@/lib/constants';
import {
  ECUADOR_PATH,
  ECUADOR_VIEWBOX,
  projectLatLng,
} from '@/lib/ecuador-geo';
import type { Project } from '@/types';

interface Props {
  projects: Project[];
  /** If true, hides the right-side city list to leave only the map. */
  compact?: boolean;
}

interface CityGroup {
  city: string;
  lat: number;
  lng: number;
  projects: Project[];
  totalContract: number;
}

export function EcuadorMap({ projects, compact = false }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  const cities = useMemo<CityGroup[]>(() => {
    const map = new Map<string, CityGroup>();
    for (const p of projects) {
      if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') continue;
      const key = p.city || `${p.latitude},${p.longitude}`;
      const e = map.get(key) ?? {
        city: p.city || 'Sin ciudad',
        lat: p.latitude,
        lng: p.longitude,
        projects: [],
        totalContract: 0,
      };
      e.projects.push(p);
      e.totalContract += Number(p.contractAmount);
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => b.projects.length - a.projects.length);
  }, [projects]);

  const withoutCity = projects.filter(
    (p) => !p.city || p.latitude == null || p.longitude == null,
  );

  const { width: VW, height: VH } = ECUADOR_VIEWBOX;

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Proyectos por ubicación</h2>
          <p className="text-xs text-ink-secondary">
            {cities.length} {cities.length === 1 ? 'ciudad' : 'ciudades'} ·{' '}
            {projects.length - withoutCity.length} de {projects.length} proyectos geolocalizados
          </p>
        </div>
        {withoutCity.length > 0 && (
          <span className="badge-muted">{withoutCity.length} sin ciudad</span>
        )}
      </div>

      <div className={compact ? '' : 'grid gap-4 md:grid-cols-[1.4fr_1fr]'}>
        {/* MAPA */}
        <div
          className="relative overflow-hidden rounded-2xl border border-surface-border"
          style={{
            background:
              'radial-gradient(ellipse at 30% 20%, #FFFFFF 0%, #FAF7F4 60%, #F0EBE4 100%)',
          }}
        >
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            className="block h-auto w-full"
            style={{ maxHeight: 500 }}
          >
            <defs>
              {/* Gradiente de tierra (rojo CREACOM muy suave) */}
              <linearGradient id="land" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDF1EE" />
                <stop offset="60%" stopColor="#FAD8D0" />
                <stop offset="100%" stopColor="#F3B3A6" />
              </linearGradient>

              {/* Sombra suave debajo del país */}
              <filter id="landShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
                <feOffset dx="0" dy="4" result="shadow" />
                <feFlood floodColor="#C73E2C" floodOpacity="0.18" />
                <feComposite in2="shadow" operator="in" />
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Glow para los pines */}
              <filter id="pinGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Patrón de cuadrícula sutil */}
              <pattern
                id="grid"
                x="0"
                y="0"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="#C73E2C"
                  strokeOpacity="0.04"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>

            <rect x="0" y="0" width={VW} height={VH} fill="url(#grid)" />

            {/* Tierra de Ecuador con sombra */}
            <g filter="url(#landShadow)">
              <path
                d={ECUADOR_PATH}
                fill="url(#land)"
                stroke="#C73E2C"
                strokeOpacity="0.55"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </g>

            {/* Borde interior elegante */}
            <path
              d={ECUADOR_PATH}
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity="0.5"
              strokeWidth="1"
            />

            {/* Etiqueta del país */}
            <text
              x={VW * 0.55}
              y={VH * 0.5}
              textAnchor="middle"
              className="select-none"
              fontSize="22"
              fontWeight="600"
              fill="#C73E2C"
              fillOpacity="0.18"
              letterSpacing="6"
            >
              ECUADOR
            </text>

            {/* Pines de proyectos */}
            {cities.map((c, idx) => {
              const { x, y } = projectLatLng(c.lat, c.lng);
              const isHover = hover === c.city;
              const size = Math.min(18, 9 + c.projects.length * 2);
              return (
                <g
                  key={`${c.city}-${idx}`}
                  onMouseEnter={() => setHover(c.city)}
                  onMouseLeave={() => setHover(null)}
                  className="cursor-pointer transition-transform duration-200"
                  style={{ transformOrigin: `${x}px ${y}px`, transform: isHover ? 'scale(1.15)' : 'scale(1)' }}
                >
                  {/* Halo pulsante */}
                  <circle
                    cx={x}
                    cy={y}
                    r={size + 14}
                    fill="#C73E2C"
                    opacity={isHover ? 0.18 : 0.08}
                    className="transition-opacity duration-200"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={size + 7}
                    fill="#C73E2C"
                    opacity={isHover ? 0.28 : 0.14}
                    className="transition-opacity duration-200"
                  />
                  {/* Anillo blanco */}
                  <circle
                    cx={x}
                    cy={y}
                    r={size + 2}
                    fill="#FFFFFF"
                    stroke="#FFFFFF"
                    strokeWidth="1"
                  />
                  {/* Pin sólido */}
                  <circle
                    cx={x}
                    cy={y}
                    r={size}
                    fill="#C73E2C"
                    filter="url(#pinGlow)"
                  />
                  {/* Punto blanco central */}
                  <circle cx={x} cy={y} r={size * 0.35} fill="#FFFFFF" />
                  {c.projects.length > 1 && (
                    <text
                      x={x}
                      y={y + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="11"
                      fontWeight="700"
                      fill="#C73E2C"
                      className="select-none pointer-events-none"
                    >
                      {c.projects.length}
                    </text>
                  )}

                  {/* Etiqueta con caja blanca arriba */}
                  {(isHover || c.projects.length > 1) && (
                    <g className="pointer-events-none">
                      <rect
                        x={x - 50}
                        y={y - size - 28}
                        width="100"
                        height="18"
                        rx="9"
                        fill="#FFFFFF"
                        stroke="#C73E2C"
                        strokeOpacity="0.3"
                        strokeWidth="1"
                      />
                      <text
                        x={x}
                        y={y - size - 16}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="600"
                        fill="#1A1A1A"
                      >
                        {c.city}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Punto de referencia: Quito como capital (siempre visible) */}
            {!cities.find((c) => c.city === 'Quito') && (
              (() => {
                const { x, y } = projectLatLng(-0.1807, -78.4678);
                return (
                  <g className="pointer-events-none opacity-40">
                    <circle cx={x} cy={y} r="3" fill="#1A1A1A" />
                    <text x={x + 6} y={y + 3} fontSize="9" fill="#5C5C5C">
                      Quito ★
                    </text>
                  </g>
                );
              })()
            )}
          </svg>
        </div>

        {/* LISTA LATERAL — solo si no es compact */}
        {!compact && (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {cities.length === 0 ? (
            <div className="rounded-lg border border-dashed border-surface-border bg-surface-muted/40 p-6 text-center text-xs text-ink-secondary">
              📍 Ninguno de tus proyectos tiene ciudad asignada todavía. Edita un proyecto
              y elige una ciudad para verlo en el mapa.
            </div>
          ) : (
            cities.map((c) => (
              <div
                key={c.city}
                onMouseEnter={() => setHover(c.city)}
                onMouseLeave={() => setHover(null)}
                className={`rounded-lg border p-3 transition-all ${
                  hover === c.city
                    ? 'border-brand shadow-card -translate-y-0.5 bg-surface'
                    : 'border-surface-border bg-surface'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">📍</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink-primary">
                        {c.city}
                      </div>
                      <div className="text-[10px] text-ink-tertiary">
                        {formatCurrency(c.totalContract)} contratado
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 badge bg-brand-light text-brand">
                    {c.projects.length}
                  </span>
                </div>
                <ul className="mt-2 space-y-1">
                  {c.projects.map((p) => (
                    <li key={p.id} className="truncate text-xs">
                      <Link
                        href={ROUTES.PROJECT_BUDGET(p.id)}
                        className="text-ink-secondary transition-colors hover:text-brand"
                      >
                        {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        )}
      </div>
    </div>
  );
}
