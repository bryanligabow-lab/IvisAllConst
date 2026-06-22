'use client';

import { useRef, useState } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layouts/AppShell';
import { ProjectTabs } from '@/components/layouts/ProjectTabs';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { apiDelete, apiGet, apiPost, ApiClientError } from '@/lib/api';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type { ProjectSummary } from '@/types';

interface ProjectDocument {
  id: string;
  label: string | null;
  filename: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploader: { firstName: string; lastName: string; email: string } | null;
}

const MAX_FILE_MB = 25;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:<mime>;base64,XXXX" — strip the prefix
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileIcon(mime: string): string {
  if (mime === 'application/pdf') return '📄';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.includes('word')) return '📝';
  if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊';
  if (mime === 'application/zip') return '📦';
  return '📎';
}

export default function ProjectDocumentsPage() {
  const params = useParams<{ id: string }>();
  const { data: summary } = useSWR<ProjectSummary>(`/projects/${params.id}/summary`, apiGet);
  const { data: docs, mutate } = useSWR<ProjectDocument[]>(
    `/projects/${params.id}/documents`,
    apiGet,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const canWrite = useAuthStore().can('projects.update');

  const [label, setLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectDocument | null>(null);

  async function uploadFile(file: File) {
    setError(null);
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`El archivo excede el límite de ${MAX_FILE_MB} MB.`);
      return;
    }
    setUploading(true);
    setProgress(`Cargando "${file.name}"…`);
    try {
      const dataBase64 = await fileToBase64(file);
      await apiPost(`/projects/${params.id}/documents`, {
        label: label.trim() || undefined,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataBase64,
      });
      setLabel('');
      await mutate();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo subir el documento');
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function downloadDoc(doc: ProjectDocument) {
    const token =
      typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) : null;
    const res = await fetch(`${API_BASE_URL}/projects/${params.id}/documents/${doc.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!res.ok) {
      window.alert('No se pudo descargar el documento.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <ProjectTabs projectId={params.id} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">
            Documentación {summary ? `— ${summary.project.name}` : ''}
          </h1>
          <p className="text-xs text-ink-secondary">
            Adjunta contratos, planos, permisos, actas y cualquier respaldo del proyecto. Hasta {MAX_FILE_MB} MB por archivo.
          </p>
        </div>
      </div>

      {canWrite && (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void uploadFile(file);
        }}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? 'border-brand bg-brand-light/30'
            : 'border-surface-border bg-surface-muted/30'
        }`}
      >
        <div className="mb-3 text-5xl">📎</div>
        <p className="text-sm font-medium text-ink-primary">
          Arrastra un archivo aquí o pulsa para seleccionar
        </p>
        <p className="mt-1 text-xs text-ink-secondary">
          PDF, imágenes, Word, Excel, CSV, ZIP · máximo {MAX_FILE_MB} MB
        </p>

        <div className="mx-auto mt-4 flex max-w-xl flex-wrap items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='Etiqueta (opcional, ej. "Contrato original")'
            className="flex-1 min-w-0 rounded-md border border-surface-border bg-surface px-3 py-2 text-sm"
            disabled={uploading}
          />
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn-primary disabled:opacity-50"
          >
            {uploading ? 'Subiendo…' : 'Seleccionar archivo'}
          </button>
        </div>

        {progress && (
          <p className="mt-3 text-xs text-ink-secondary">{progress}</p>
        )}
        {error && (
          <p className="mt-3 rounded-md border border-danger/40 bg-danger-soft px-3 py-1.5 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
      )}

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-medium">
          Archivos adjuntos {docs ? `(${docs.length})` : ''}
        </h2>

        {!docs && <div className="text-sm text-ink-secondary">Cargando…</div>}

        {docs && docs.length === 0 && (
          <div className="card text-sm text-ink-secondary">
            Aún no hay documentos. Sube el primero arrastrándolo arriba.
          </div>
        )}

        {docs && docs.length > 0 && (
          <div className="card overflow-x-auto">
            <table className="table-default">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Etiqueta</th>
                  <th>Subido por</th>
                  <th>Fecha</th>
                  <th className="text-right">Tamaño</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium">
                      <span className="mr-2">{fileIcon(d.mimeType)}</span>
                      {d.filename}
                    </td>
                    <td className="text-sm text-ink-secondary">{d.label || '—'}</td>
                    <td className="text-xs text-ink-secondary">
                      {d.uploader ? `${d.uploader.firstName} ${d.uploader.lastName}` : '—'}
                    </td>
                    <td className="text-xs text-ink-secondary">{formatDate(d.createdAt)}</td>
                    <td className="text-right text-xs">{formatBytes(d.fileSize)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => downloadDoc(d)}
                          className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-surface-muted hover:text-ink-primary"
                          title="Descargar"
                        >
                          ⬇️
                        </button>
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => setPendingDelete(d)}
                            className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        itemLabel={pendingDelete ? `el documento "${pendingDelete.filename}"` : ''}
        onConfirm={async (code) => {
          if (!pendingDelete) return;
          await apiDelete(
            `/projects/${params.id}/documents/${pendingDelete.id}`,
            { deleteCode: code },
          );
          await mutate();
          setPendingDelete(null);
        }}
      />
    </AppShell>
  );
}
