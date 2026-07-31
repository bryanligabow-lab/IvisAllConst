'use client';

import { useEffect, useState } from 'react';
import type { SupportSentinel } from '@/types';

// Cuenta regresiva en vivo (mm:ss) hasta un instante objetivo.
function useCountdown(target: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return null;
  return Math.max(0, Math.round((new Date(target).getTime() - now) / 1000));
}

export function formatMMSS(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Banner "Vigilante activo · próxima revisión en MM:SS". Honesto: si el latido
// se enfrió (loop detenido), dice "en pausa" en vez de prometer una revisión.
export function SentinelTimer({ sentinel }: { sentinel: SupportSentinel }) {
  const secs = useCountdown(sentinel.nextReviewAt);

  if (!sentinel.lastCheckAt) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-surface-border bg-surface-muted/40 px-4 py-2.5 text-xs text-ink-secondary">
        <span className="h-2 w-2 shrink-0 rounded-full bg-ink-tertiary" />
        <span>
          Revisión automática no configurada aún. Se activa cuando el técnico deja corriendo la
          revisión periódica.
        </span>
      </div>
    );
  }

  if (!sentinel.active) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-soft/40 px-4 py-2.5 text-xs">
        <span className="h-2 w-2 shrink-0 rounded-full bg-warning" />
        <span className="text-ink-secondary">
          <span className="font-semibold text-warning">Revisión en pausa.</span> El vigilante no
          ha revisado en un rato; las incidencias nuevas se atenderán cuando se reanude.
        </span>
      </div>
    );
  }

  // Activo. Si el contador llegó a 0, la revisión está por ocurrir.
  const label =
    secs !== null && secs > 0 ? (
      <>
        próxima revisión en{' '}
        <span className="font-mono font-semibold text-ink-primary tabular-nums">
          {formatMMSS(secs)}
        </span>
      </>
    ) : (
      <span className="font-semibold text-ink-primary">revisando ahora…</span>
    );

  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/40 bg-success-soft/40 px-4 py-2.5 text-xs">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      <span className="text-ink-secondary">
        <span className="font-semibold text-success">Vigilante activo</span> · {label}
        <span className="ml-1 text-ink-tertiary">(cada {sentinel.cadenceMinutes} min)</span>
      </span>
    </div>
  );
}

// Chip de ETA de resolución por incidencia (Timer #2). Muestra en cuánto se
// atenderá, derivado del centinela. Solo tiene sentido para las pendientes.
export function ResolutionEta({
  status,
  sentinel,
}: {
  status: string;
  sentinel: SupportSentinel;
}) {
  const secs = useCountdown(sentinel.nextReviewAt);
  if (status === 'RESUELTA') return <span className="text-success">✅ Resuelta</span>;
  if (status === 'CERRADA') return null;
  if (!sentinel.active || secs === null) return null;
  const mins = Math.max(1, Math.ceil(secs / 60));
  return (
    <span className="text-ink-tertiary" title="Estimado según la próxima revisión del técnico">
      ⏳ se atiende en ~{mins} min
    </span>
  );
}
