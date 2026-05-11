'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import { ROUTES } from '@/lib/constants';
import type { Project } from '@/types';

interface Props {
  projects: Project[];
}

// Bounding box (Ecuador continental, dejando un poco de margen)
const BOUNDS = {
  minLat: -5.0,
  maxLat: 1.5,
  minLng: -81.0,
  maxLng: -75.0,
};

// Path simplificado de Ecuador continental + límites internos suaves
// Coordenadas geográficas convertidas a un viewBox 800x900.
// (Aproximación visual — no es cartográficamente exacto.)
const ECUADOR_PATH = `
M 240 95 L 285 70 L 330 78 L 380 92 L 415 110 L 450 130 L 480 150
L 515 175 L 560 195 L 600 215 L 640 235 L 670 270 L 695 305 L 715 345
L 720 390 L 712 430 L 692 465 L 678 500 L 690 535 L 705 570 L 712 610
L 695 640 L 660 660 L 615 670 L 568 668 L 525 660 L 480 650 L 432 640
L 388 625 L 348 605 L 310 580 L 280 545 L 258 510 L 244 470 L 235 425
L 240 380 L 250 335 L 248 290 L 232 250 L 218 215 L 215 175 L 222 135
L 240 95 Z
`;

function project(lat: number, lng: number): { x: number; y: number } {
  // Mapear lat/lng al viewBox 800x900
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 800;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 900;
  return { x, y };
}

export function EcuadorMap({ projects }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  // Agrupar proyectos por ciudad (varios proyectos en la misma ciudad → un punto con count)
  const cities = useMemo(() => {
    const map = new Map<
      string,
      { city: string; lat: number; lng: number; projects: Project[] }
    >();
    for (const p of projects) {
      if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') continue;
      const key = p.city || `${p.latitude},${p.longitude}`;
      const e = map.get(key) ?? {
        city: p.city || 'Sin ciudad',
        lat: p.latitude,
        lng: p.longitude,
        projects: [],
      };
      e.projects.push(p);
      map.set(key, e);
    }
    return Array.from(map.values());
  }, [projects]);

  const withoutCity = projects.filter((p) => !p.city || p.latitude == null || p.longitude == null);

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Proyectos por ubicación</h2>
          <p className="text-xs text-ink-secondary">
            {cities.length} {cities.length === 1 ? 'ciudad' : 'ciudades'} ·{' '}
            {projects.length - withoutCity.length} de {projects.length} proyectos geolocalizados
          </p>
        </div>
        {withoutCity.length > 0 && (
          <span className="badge-muted">
            {withoutCity.length} sin ciudad
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="relative rounded-lg border border-surface-border bg-surface-muted/50 p-3">
          <svg viewBox="200 50 540 660" className="h-auto w-full max-h-[440px]">
            {/* Líneas de cuadrícula sutiles */}
            <defs>
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
                  stroke="currentColor"
                  strokeOpacity="0.04"
                  strokeWidth="0.5"
                />
              </pattern>
              <linearGradient id="land-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FCEDEA" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#FAD8D0" stopOpacity="0.5" />
              </linearGradient>
            </defs>
            <rect x="200" y="50" width="540" height="660" fill="url(#grid)" />

            {/* Tierra (Ecuador) */}
            <path
              d={ECUADOR_PATH}
              fill="url(#land-grad)"
              stroke="#C73E2C"
              strokeOpacity="0.45"
              strokeWidth="1.5"
            />

            {/* Etiqueta del país */}
            <text
              x="470"
              y="320"
              textAnchor="middle"
              className="fill-ink-tertiary"
              fontSize="14"
              fontWeight="500"
              opacity="0.45"
            >
              ECUADOR
            </text>

            {/* Marcadores */}
            {cities.map((c, idx) => {
              const { x, y } = project(c.lat, c.lng);
              const isHover = hover === c.city;
              const size = Math.min(20, 8 + c.projects.length * 3);
              return (
                <g
                  key={`${c.city}-${idx}`}
                  onMouseEnter={() => setHover(c.city)}
                  onMouseLeave={() => setHover(null)}
                  className="cursor-pointer"
                >
                  {/* Halo pulsante */}
                  <circle
                    cx={x}
                    cy={y}
                    r={size + 6}
                    fill="#C73E2C"
                    opacity={isHover ? 0.25 : 0.12}
                    className="transition-opacity"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={size}
                    fill="#C73E2C"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    className="drop-shadow-sm transition-all"
                  />
                  {c.projects.length > 1 && (
                    <text
                      x={x}
                      y={y + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="9"
                      fontWeight="700"
                      fill="#FFFFFF"
                    >
                      {c.projects.length}
                    </text>
                  )}
                  <text
                    x={x}
                    y={y - size - 4}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    className="fill-ink-primary"
                  >
                    {c.city}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Lista al lado */}
        <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
          {cities.length === 0 ? (
            <div className="rounded-lg border border-dashed border-surface-border bg-surface-muted/40 p-6 text-center text-xs text-ink-secondary">
              📍 Ninguno de tus proyectos tiene ciudad asignada todavía. Edita un proyecto y
              elige una ciudad para verlo en el mapa.
            </div>
          ) : (
            cities.map((c) => (
              <div
                key={c.city}
                onMouseEnter={() => setHover(c.city)}
                onMouseLeave={() => setHover(null)}
                className={`rounded-lg border p-3 transition-all ${
                  hover === c.city
                    ? 'border-brand shadow-soft -translate-y-0.5 bg-surface'
                    : 'border-surface-border bg-surface'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-ink-primary">{c.city}</div>
                  <span className="badge bg-brand-light text-brand">
                    {c.projects.length} {c.projects.length === 1 ? 'proyecto' : 'proyectos'}
                  </span>
                </div>
                <ul className="mt-2 space-y-1">
                  {c.projects.map((p) => (
                    <li key={p.id} className="text-xs">
                      <Link
                        href={ROUTES.PROJECT_BUDGET(p.id)}
                        className="text-ink-secondary hover:text-brand"
                      >
                        {p.name}{' '}
                        <span className="text-ink-tertiary">
                          · {formatCurrency(Number(p.contractAmount))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
