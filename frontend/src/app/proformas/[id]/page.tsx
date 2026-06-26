'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { useState } from 'react';
import { AppShell } from '@/components/layouts/AppShell';
import { CreateProformaModal, type ProformaEditData } from '@/components/forms/CreateProformaModal';
import { apiGet } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatCalendarDate } from '@/lib/format';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';

interface ProformaDetail {
  id: string;
  number: string;
  date: string;
  clientName: string;
  clientRuc: string | null;
  clientAddress: string | null;
  clientResponsible: string | null;
  projectLabel: string | null;
  ivaPercent: number;
  creditTerm: string | null;
  paymentTerms: string | null;
  validity: string | null;
  topClients: string | null;
  signerName: string | null;
  signerTitle: string | null;
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED';
  subtotal: number;
  iva: number;
  total: number;
  project?: { id: string; name: string; code: string } | null;
  items: Array<{
    id: string;
    quantity: number;
    unit: string;
    description: string;
    unitPrice: number;
  }>;
}

// Saca el nombre del archivo del header Content-Disposition (lo arma el backend
// e incluye el proyecto). Si no se puede leer, usa el fallback.
function filenameFromDisposition(cd: string | null, fallback: string): string {
  if (!cd) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      /* ignore */
    }
  }
  const plain = /filename="([^"]+)"/i.exec(cd);
  if (plain) return plain[1];
  return fallback;
}

async function downloadExport(
  id: string,
  format: 'pdf' | 'xlsx',
  number: string,
  projectLabel?: string | null,
) {
  const token =
    typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) : null;
  const res = await fetch(`${API_BASE_URL}/proformas/${id}/export?format=${format}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    window.alert(`No se pudo generar el ${format.toUpperCase()}`);
    return;
  }
  // Nombre por defecto incluyendo el proyecto (por si no se puede leer el header).
  const proyecto = (projectLabel ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const fallback = proyecto
    ? `Proforma ${number} - ${proyecto}.${format}`
    : `Proforma ${number}.${format}`;
  const filename = filenameFromDisposition(res.headers.get('content-disposition'), fallback);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ProformaDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading, mutate } = useSWR<ProformaDetail>(`/proformas/${params.id}`, apiGet);
  const { can } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading || !data) {
    return (
      <AppShell>
        <div className="text-sm text-ink-secondary">Cargando proforma…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link href="/proformas" className="text-xs text-brand hover:underline">
        ← Volver a proformas
      </Link>

      <div className="mt-3 mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Proforma <span className="text-brand">{data.number}</span>
          </h1>
          <p className="text-xs text-ink-secondary">
            {formatCalendarDate(data.date)} · {data.clientName}
            {data.projectLabel ? ` · ${data.projectLabel}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {can('proformas.write') && (
            <button onClick={() => setEditOpen(true)} className="btn-secondary">
              ✏️ Editar
            </button>
          )}
          <button
            onClick={() => downloadExport(data.id, 'pdf', data.number, data.projectLabel)}
            className="btn-primary"
          >
            📄 Exportar PDF
          </button>
          <button
            onClick={() => downloadExport(data.id, 'xlsx', data.number, data.projectLabel)}
            className="btn-success"
          >
            📊 Exportar Excel
          </button>
        </div>
      </div>

      {/* Vista previa interna estilo proforma */}
      <div className="rounded-xl border-2 border-surface-border bg-surface p-8 shadow-card">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold text-brand">CREACOM S.A.</div>
            <div className="text-xs text-ink-secondary">Innovación · Proyectos · Servicios</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-brand">PROFORMA</div>
            <div className="text-sm font-medium">No. {data.number}</div>
          </div>
        </div>
        <div className="mb-4 h-0.5 bg-brand" />
        <div className="mb-5 text-right text-xs text-ink-secondary">{formatCalendarDate(data.date)}</div>

        <div className="mb-6 grid grid-cols-2 gap-6 text-xs">
          <div>
            <div className="font-bold">CREA INNOVACION PROYECTOS Y SERVICIOS</div>
            <div className="font-bold">CREACOM S.A.</div>
            <div className="mt-1 text-ink-secondary">RUC: 0993273708001</div>
            <div className="text-ink-secondary">AUT SRI: 31234567817</div>
            <div className="text-ink-secondary">DIRECCION: AV. GUAYAQUIL, ED. MARCIMEX</div>
          </div>
          <div className="text-right">
            <div className="font-bold">{data.clientName}</div>
            {data.clientRuc && <div className="mt-1 text-ink-secondary">RUC: {data.clientRuc}</div>}
            {data.clientAddress && (
              <div className="text-ink-secondary">DIRECCION: {data.clientAddress}</div>
            )}
            {(data.projectLabel || data.project) && (
              <div className="text-ink-secondary">
                PROYECTO: {data.projectLabel || data.project?.name}
              </div>
            )}
            {data.clientResponsible && (
              <div className="text-ink-secondary">RESPONSABLE: {data.clientResponsible}</div>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div className="mb-4 overflow-x-auto rounded-md border border-surface-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-brand text-white">
                <th className="px-3 py-2 text-center">CANT</th>
                <th className="px-3 py-2 text-center">UNI</th>
                <th className="px-3 py-2 text-center">DETALLE</th>
                <th className="px-3 py-2 text-right">V. UNITARIO</th>
                <th className="px-3 py-2 text-right">V. TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.id} className="border-t border-surface-border">
                  <td className="px-3 py-2 text-center">{it.quantity}</td>
                  <td className="px-3 py-2 text-center">{it.unit}</td>
                  <td className="px-3 py-2 text-center">{it.description}</td>
                  <td className="px-3 py-2 text-right">${formatCurrency(it.unitPrice).replace('$','').trim()}</td>
                  <td className="px-3 py-2 text-right font-medium">${formatCurrency(it.quantity * it.unitPrice).replace('$','').trim()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer 2 columnas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border-2 border-brand p-3 text-xs">
            {data.creditTerm && <div>• Plazo de credito: {data.creditTerm}</div>}
            {data.paymentTerms && <div>• Forma de pago: {data.paymentTerms}</div>}
            {data.validity && <div>• Vigencia de la oferta: {data.validity}</div>}
            {data.topClients && (
              <>
                <div className="mt-2 font-bold">PRINCIPALES CLIENTES:</div>
                {data.topClients
                  .split('\n')
                  .filter(Boolean)
                  .map((c, i) => (
                    <div key={i}>• {c}</div>
                  ))}
              </>
            )}
          </div>
          <div>
            <div className="flex justify-between border-b border-surface-border py-2 text-sm font-semibold">
              <span>SUBTOTAL:</span>
              <span>{formatCurrency(data.subtotal, true)}</span>
            </div>
            <div className="flex justify-between border-b border-surface-border py-2 text-sm font-semibold">
              <span>IVA {data.ivaPercent}%</span>
              <span>{formatCurrency(data.iva, true)}</span>
            </div>
            <div className="flex justify-between bg-brand-light px-2 py-2 text-lg font-bold text-brand">
              <span>TOTAL:</span>
              <span>{formatCurrency(data.total, true)}</span>
            </div>

            <div className="mt-10 text-center text-xs">
              <div className="mx-auto mb-1 h-px w-40 bg-ink-primary" />
              <div className="font-bold">{data.signerName || 'Gabriel Constantine L.'}</div>
              <div className="text-ink-secondary">{data.signerTitle || 'Gerente General'}</div>
            </div>
          </div>
        </div>
      </div>

      <CreateProformaModal
        open={editOpen}
        initial={editOpen ? (data as unknown as ProformaEditData) : null}
        onClose={() => setEditOpen(false)}
        onCreated={() => {
          mutate();
          setEditOpen(false);
        }}
      />
    </AppShell>
  );
}
