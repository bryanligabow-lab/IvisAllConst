'use client';

import { Field } from '@/components/ui/Modal';
import { InvoiceThumb } from '@/components/ui/InvoiceThumb';
import type { InvoiceFile } from '@/components/forms/InvoiceUpload';

const MAX_SIZE = 6 * 1024 * 1024; // 6 MB
const MAX_DOCS = 15;

export interface ExistingDoc {
  id: string;
  path: string;
  mime: string | null;
}

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
  existing: ExistingDoc[];
  removedIds: string[];
  onToggleRemove: (id: string) => void;
  newDocs: InvoiceFile[];
  onAdd: (f: InvoiceFile) => void;
  onRemoveNew: (idx: number) => void;
  onError?: (m: string) => void;
}

// Permite adjuntar VARIAS facturas/documentos (foto o PDF) a un gasto.
export function GastoDocsField({
  existing,
  removedIds,
  onToggleRemove,
  newDocs,
  onAdd,
  onRemoveNew,
  onError,
}: Props) {
  const visibleExisting = existing.filter((d) => !removedIds.includes(d.id));
  const total = visibleExisting.length + newDocs.length;

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (total + newDocs.length >= MAX_DOCS) {
        onError?.(`Máximo ${MAX_DOCS} archivos por gasto.`);
        break;
      }
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      if (!isImage && !isPdf) {
        onError?.('Solo se permiten imágenes (foto) o PDF.');
        continue;
      }
      if (file.size > MAX_SIZE) {
        onError?.(`"${file.name}" pesa más de 6 MB.`);
        continue;
      }
      const { dataUrl, base64 } = await fileToData(file);
      onAdd({ base64, mime: file.type, preview: dataUrl, name: file.name, isImage });
    }
  }

  return (
    <Field
      label="Facturas / documentos"
      hint="Opcional · puedes adjuntar varios (foto o PDF, máx 6 MB c/u). En el celular puedes tomar la foto."
    >
      <div className="flex flex-wrap items-center gap-2">
        {visibleExisting.map((d) => (
          <div key={d.id} className="relative">
            <InvoiceThumb path={d.path} mime={d.mime} className="h-14 w-14" />
            <button
              type="button"
              onClick={() => onToggleRemove(d.id)}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] text-white shadow"
              title="Quitar"
            >
              ✕
            </button>
          </div>
        ))}

        {newDocs.map((d, idx) => (
          <div key={`new-${idx}`} className="relative">
            {d.isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={d.preview}
                alt="factura"
                className="h-14 w-14 rounded border border-surface-border object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded border border-surface-border text-xl">
                📄
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemoveNew(idx)}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] text-white shadow"
              title="Quitar"
            >
              ✕
            </button>
          </div>
        ))}

        <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded border border-dashed border-surface-border text-2xl text-ink-tertiary hover:bg-surface-muted">
          +
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>
    </Field>
  );
}
