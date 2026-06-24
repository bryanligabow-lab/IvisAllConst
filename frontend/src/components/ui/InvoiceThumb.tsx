'use client';

import { useState } from 'react';
import { AuthImage } from '@/components/ui/AuthImage';
import { apiFetchBlob } from '@/lib/api';

interface Props {
  /** Ruta protegida que sirve el binario, ej. /gastos/:id/invoice */
  path: string;
  mime?: string | null;
  className?: string;
}

// Miniatura de la factura (foto o PDF). Al tocarla, abre el archivo en una
// pestaña nueva (descarga el blob con el token y lo abre).
export function InvoiceThumb({ path, mime, className }: Props) {
  const [loading, setLoading] = useState(false);
  const isImage = (mime ?? '').startsWith('image/');

  async function open() {
    setLoading(true);
    try {
      const blob = await apiFetchBlob(path);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Liberar después de un rato (el navegador ya abrió la pestaña).
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }

  if (isImage) {
    return (
      <AuthImage
        path={path}
        alt="factura"
        onClick={open}
        className={`h-9 w-9 cursor-pointer rounded border border-surface-border object-cover ${className ?? ''}`}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className="inline-flex items-center gap-1 rounded-md border border-surface-border px-2 py-1 text-[11px] text-ink-secondary hover:bg-surface-muted"
      title="Ver factura"
    >
      📄 {loading ? '…' : 'Factura'}
    </button>
  );
}
