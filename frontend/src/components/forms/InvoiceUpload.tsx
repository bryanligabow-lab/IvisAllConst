'use client';

import { Field } from '@/components/ui/Modal';
import { InvoiceThumb } from '@/components/ui/InvoiceThumb';

export interface InvoiceFile {
  base64: string; // sin prefijo data:
  mime: string;
  preview: string; // data URL para previsualizar
  name: string;
  isImage: boolean;
}

const MAX_SIZE = 6 * 1024 * 1024; // 6 MB

function fileToData(file: File): Promise<{ dataUrl: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({ dataUrl, base64: dataUrl.replace(/^data:[^;]+;base64,/, '') });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface Props {
  value: InvoiceFile | null;
  onChange: (v: InvoiceFile | null) => void;
  label?: string;
  onError?: (msg: string) => void;
  /** Factura ya guardada (modo edición): ruta protegida + mime. */
  existingPath?: string;
  existingMime?: string | null;
  existingRemoved?: boolean;
  onRemoveExisting?: () => void;
}

// Subir foto (o PDF) de la factura. En el celular permite tomar foto o elegir
// de la galería. En edición muestra la factura ya guardada.
export function InvoiceUpload({
  value,
  onChange,
  label = 'Foto de la factura',
  onError,
  existingPath,
  existingMime,
  existingRemoved,
  onRemoveExisting,
}: Props) {
  async function handle(file: File | undefined | null) {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) {
      onError?.('Solo se permite una imagen (foto) o un PDF.');
      return;
    }
    if (file.size > MAX_SIZE) {
      onError?.(`"${file.name}" pesa más de 6 MB. Reduce el tamaño y vuelve a intentar.`);
      return;
    }
    const { dataUrl, base64 } = await fileToData(file);
    onChange({ base64, mime: file.type, preview: dataUrl, name: file.name, isImage });
  }

  const showExisting = !value && !!existingPath && !!existingMime && !existingRemoved;

  return (
    <Field label={label} hint="Opcional · foto o PDF (máx 6 MB). En el celular puedes tomar la foto.">
      <div className="flex items-center gap-3">
        {value ? (
          value.isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.preview}
              alt="factura"
              className="h-16 w-16 shrink-0 rounded border border-surface-border object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-surface-border text-2xl">
              📄
            </div>
          )
        ) : showExisting ? (
          <div className="shrink-0">
            <InvoiceThumb path={existingPath!} mime={existingMime} className="h-16 w-16" />
          </div>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-dashed border-surface-border text-[10px] text-ink-tertiary">
            sin factura
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="btn-secondary cursor-pointer text-xs">
            {value || showExisting ? 'Cambiar' : '📷 Subir factura'}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handle(e.target.files?.[0])}
            />
          </label>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs text-ink-secondary hover:text-danger"
            >
              Quitar
            </button>
          )}
          {showExisting && onRemoveExisting && (
            <button
              type="button"
              onClick={onRemoveExisting}
              className="text-xs text-ink-secondary hover:text-danger"
            >
              Quitar
            </button>
          )}
          {value && !value.isImage && (
            <span className="max-w-[160px] truncate text-[11px] text-ink-tertiary">{value.name}</span>
          )}
        </div>
      </div>
    </Field>
  );
}
