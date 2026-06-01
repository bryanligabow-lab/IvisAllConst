'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layouts/AppShell';
import { ProjectTabs } from '@/components/layouts/ProjectTabs';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { apiDelete, apiGet, apiPost, ApiClientError } from '@/lib/api';
import { formatCalendarDate } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type { ProjectSummary } from '@/types';

interface BitacoraEntry {
  id: string;
  date: string;
  weather: string | null;
  workforce: number | null;
  title: string | null;
  content: string;
  createdAt: string;
  creator?: { firstName: string; lastName: string; email: string };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function BitacoraPage() {
  const params = useParams<{ id: string }>();
  const { can } = useAuthStore();
  const canWrite = can('bitacora.write');

  const { data: summary } = useSWR<ProjectSummary>(`/projects/${params.id}/summary`, apiGet);
  const { data: entries, isLoading, mutate } = useSWR<BitacoraEntry[]>(
    `/bitacora?projectId=${params.id}`,
    apiGet,
  );

  const [date, setDate] = useState(today());
  const [weather, setWeather] = useState('');
  const [workforce, setWorkforce] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BitacoraEntry | null>(null);

  function resetForm() {
    setDate(today());
    setWeather('');
    setWorkforce('');
    setTitle('');
    setContent('');
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError('Escribe las novedades del día');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/bitacora', {
        projectId: params.id,
        date,
        weather: weather || undefined,
        workforce: workforce ? Number(workforce) : undefined,
        title: title || undefined,
        content: content.trim(),
      });
      resetForm();
      await mutate();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo guardar la entrada');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <ProjectTabs projectId={params.id} />

      <div className="mb-4">
        <h1 className="text-lg font-medium">
          Bitácora — Libro de obra {summary ? `· ${summary.project.name}` : ''}
        </h1>
        <p className="text-xs text-ink-secondary">
          Registro diario de novedades, clima y personal en obra.
        </p>
      </div>

      {canWrite && (
        <form onSubmit={submit} className="card mb-5 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-secondary">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-secondary">Clima</label>
              <input
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                className="input"
                placeholder="Soleado, lluvioso…"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-secondary">
                Personal en obra
              </label>
              <input
                type="number"
                min="0"
                value={workforce}
                onChange={(e) => setWorkforce(e.target.value)}
                className="input"
                placeholder="N° de trabajadores"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-secondary">
              Título (opcional)
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="Ej. Fundición de losa nivel 2"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-secondary">
              Novedades del día <span className="text-danger">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={4}
              className="input"
              placeholder="Actividades ejecutadas, avances, incidencias, materiales recibidos, visitas…"
            />
          </div>

          {error && (
            <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
              {submitting ? 'Guardando…' : 'Registrar en bitácora'}
            </button>
          </div>
        </form>
      )}

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

      {entries && entries.length === 0 && (
        <div className="card text-sm text-ink-secondary">
          Aún no hay registros en la bitácora de este proyecto.
        </div>
      )}

      <div className="space-y-3">
        {entries?.map((e) => (
          <article key={e.id} className="card">
            <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">
                  {formatCalendarDate(e.date)}
                  {e.title ? ` — ${e.title}` : ''}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-ink-secondary">
                  {e.weather && <span>🌤️ {e.weather}</span>}
                  {e.workforce != null && <span>👷 {e.workforce} en obra</span>}
                  {e.creator && (
                    <span>
                      ✍️ {e.creator.firstName} {e.creator.lastName}
                    </span>
                  )}
                </div>
              </div>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => setPendingDelete(e)}
                  className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
                  title="Eliminar entrada"
                >
                  🗑️
                </button>
              )}
            </header>
            <p className="whitespace-pre-wrap text-sm text-ink-primary">{e.content}</p>
          </article>
        ))}
      </div>

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        itemLabel={pendingDelete ? `la entrada del ${formatCalendarDate(pendingDelete.date)}` : ''}
        onConfirm={async (code) => {
          if (!pendingDelete) return;
          await apiDelete(`/bitacora/${pendingDelete.id}`, { deleteCode: code });
          await mutate();
          setPendingDelete(null);
        }}
      />
    </AppShell>
  );
}
