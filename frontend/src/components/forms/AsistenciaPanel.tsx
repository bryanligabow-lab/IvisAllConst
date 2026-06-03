'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { apiGet, apiPost, ApiClientError } from '@/lib/api';

interface ProjectLite {
  id: string;
  code: string;
  name: string;
}

interface AttendanceRow {
  employeeId: string;
  fullName: string;
  position: string | null;
  cedula: string | null;
  status: AttendanceStatus | null;
  notes: string | null;
}

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'PERMISSION' | 'REST';

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string; cls: string }> = [
  { value: 'PRESENT', label: 'Presente', cls: 'bg-success text-white' },
  { value: 'ABSENT', label: 'Falta', cls: 'bg-danger text-white' },
  { value: 'LATE', label: 'Atraso', cls: 'bg-warning text-white' },
  { value: 'PERMISSION', label: 'Permiso', cls: 'bg-brand text-white' },
  { value: 'REST', label: 'Descanso', cls: 'bg-surface-muted text-ink-primary' },
];

const STATUS_SHORT: Record<AttendanceStatus, { letter: string; cls: string }> = {
  PRESENT: { letter: 'P', cls: 'bg-success text-white' },
  ABSENT: { letter: 'F', cls: 'bg-danger text-white' },
  LATE: { letter: 'A', cls: 'bg-warning text-white' },
  PERMISSION: { letter: 'Pe', cls: 'bg-brand text-white' },
  REST: { letter: 'D', cls: 'bg-surface-muted text-ink-primary' },
};

interface HistoryRecord {
  id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  employee: { fullName: string };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// Primer y último día del mes (YYYY-MM) en formato YYYY-MM-DD.
function monthRange(month: string): { from: string; to: string; days: number } {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(days).padStart(2, '0')}`, days };
}

export function AsistenciaPanel() {
  const { data: projects } = useSWR<ProjectLite[]>('/projects?perPage=200', apiGet);
  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(today());
  const [view, setView] = useState<'REGISTRO' | 'HISTORIAL'>('REGISTRO');
  const [month, setMonth] = useState(currentMonth());

  const { from, to, days } = monthRange(month);
  const histKey =
    view === 'HISTORIAL' && projectId
      ? `/attendance/history?projectId=${projectId}&from=${from}&to=${to}`
      : null;
  const { data: history, isLoading: histLoading } = useSWR<HistoryRecord[]>(histKey, apiGet);

  // Matriz empleado × día a partir del historial.
  const matrix = useMemo(() => {
    const byEmployee = new Map<
      string,
      { name: string; days: Record<number, AttendanceStatus> }
    >();
    for (const r of history ?? []) {
      const day = Number(r.date.slice(8, 10));
      const e = byEmployee.get(r.employeeId) ?? { name: r.employee.fullName, days: {} };
      e.days[day] = r.status;
      byEmployee.set(r.employeeId, e);
    }
    return Array.from(byEmployee.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [history]);

  // Selecciona el primer proyecto disponible por defecto.
  useEffect(() => {
    if (!projectId && projects && projects.length > 0) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const key = projectId ? `/attendance?projectId=${projectId}&date=${date}` : null;
  const { data: rows, isLoading, mutate } = useSWR<AttendanceRow[]>(key, apiGet);

  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Reinicia el borrador cuando cambian los datos.
  useEffect(() => {
    if (!rows) return;
    const initial: Record<string, AttendanceStatus> = {};
    for (const r of rows) if (r.status) initial[r.employeeId] = r.status;
    setDraft(initial);
    setSavedMsg(null);
  }, [rows]);

  const presentCount = useMemo(
    () => Object.values(draft).filter((s) => s === 'PRESENT' || s === 'LATE').length,
    [draft],
  );

  function setStatus(employeeId: string, status: AttendanceStatus) {
    setDraft((prev) => ({ ...prev, [employeeId]: status }));
    setSavedMsg(null);
  }

  async function save() {
    if (!projectId || !rows) return;
    const records = rows
      .filter((r) => draft[r.employeeId])
      .map((r) => ({ employeeId: r.employeeId, status: draft[r.employeeId] }));
    if (records.length === 0) {
      setError('Marca al menos un empleado');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiPost('/attendance/bulk', { projectId, date, records });
      await mutate();
      setSavedMsg('Asistencia guardada ✓');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo guardar la asistencia');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Sub-toggle: Registro diario / Historial del mes */}
      <div className="inline-flex rounded-md border border-surface-border p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setView('REGISTRO')}
          className={`rounded px-3 py-1.5 font-medium transition-colors ${
            view === 'REGISTRO' ? 'bg-brand text-white' : 'text-ink-secondary hover:text-ink-primary'
          }`}
        >
          Registro diario
        </button>
        <button
          type="button"
          onClick={() => setView('HISTORIAL')}
          className={`rounded px-3 py-1.5 font-medium transition-colors ${
            view === 'HISTORIAL' ? 'bg-brand text-white' : 'text-ink-secondary hover:text-ink-primary'
          }`}
        >
          Historial
        </button>
      </div>

      <div className="card flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-secondary">Proyecto</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="input"
            >
              <option value="">— Selecciona —</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}. {p.name}
                </option>
              ))}
            </select>
          </div>
          {view === 'REGISTRO' ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-secondary">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-secondary">Mes</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="input"
              />
            </div>
          )}
        </div>
        {view === 'REGISTRO' && (
          <div className="text-xs text-ink-secondary sm:text-right">
            Presentes:{' '}
            <span className="font-semibold text-ink-primary">
              {presentCount}/{rows?.length ?? 0}
            </span>
          </div>
        )}
      </div>

      {/* ===== Vista Historial ===== */}
      {view === 'HISTORIAL' && (
        <>
          {!projectId && (
            <div className="card text-sm text-ink-secondary">Selecciona un proyecto.</div>
          )}
          {projectId && histLoading && (
            <div className="text-sm text-ink-secondary">Cargando…</div>
          )}
          {projectId && !histLoading && matrix.length === 0 && (
            <div className="card text-sm text-ink-secondary">
              No hay asistencia registrada en este mes.
            </div>
          )}
          {projectId && matrix.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 text-[11px] text-ink-secondary">
                {STATUS_OPTIONS.map((o) => (
                  <span key={o.value} className="inline-flex items-center gap-1">
                    <span className={`inline-block h-3 w-3 rounded-sm ${o.cls}`} />
                    {o.label} ({STATUS_SHORT[o.value].letter})
                  </span>
                ))}
              </div>
              <div className="card overflow-x-auto">
                <table className="border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-surface px-2 py-1 text-left">Empleado</th>
                      {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
                        <th key={d} className="w-7 px-0 py-1 text-center font-medium text-ink-secondary">
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row) => (
                      <tr key={row.name} className="border-t border-surface-border">
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-2 py-1 font-medium">
                          {row.name}
                        </td>
                        {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
                          const st = row.days[d];
                          return (
                            <td key={d} className="px-0.5 py-1 text-center">
                              {st ? (
                                <span
                                  className={`inline-flex h-5 w-5 items-center justify-center rounded-sm text-[10px] font-bold ${STATUS_SHORT[st].cls}`}
                                  title={STATUS_OPTIONS.find((o) => o.value === st)?.label}
                                >
                                  {STATUS_SHORT[st].letter}
                                </span>
                              ) : (
                                <span className="text-ink-tertiary">·</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {view === 'REGISTRO' && isLoading && (
        <div className="text-sm text-ink-secondary">Cargando…</div>
      )}

      {view === 'REGISTRO' && rows && rows.length === 0 && projectId && (
        <div className="card text-sm text-ink-secondary">
          Este proyecto no tiene empleados activos asignados. Asigna empleados al proyecto en la
          pestaña Empleados.
        </div>
      )}

      {view === 'REGISTRO' && rows && rows.length > 0 && (
        <div className="card space-y-2">
          {rows.map((r) => (
            <div
              key={r.employeeId}
              className="flex flex-col gap-2 border-b border-surface-border py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{r.fullName}</div>
                <div className="text-xs text-ink-secondary">
                  {r.position || '—'}
                  {r.cedula ? ` · ${r.cedula}` : ''}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {STATUS_OPTIONS.map((opt) => {
                  const active = draft[r.employeeId] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(r.employeeId, opt.value)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? opt.cls
                          : 'bg-surface-muted text-ink-secondary hover:text-ink-primary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {error && (
            <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            {savedMsg && <span className="text-xs text-success">{savedMsg}</span>}
            <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar asistencia'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
