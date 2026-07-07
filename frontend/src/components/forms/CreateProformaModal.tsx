'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Modal, Field } from '@/components/ui/Modal';
import { CreateClientModal, type Client } from '@/components/forms/CreateClientModal';
import { CreateProductModal } from '@/components/forms/CreateProductModal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { apiFetchBlob, apiGet, apiPatch, apiPost, ApiClientError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useDraft } from '@/hooks/useDraft';
import type { Product, Project } from '@/types';

const DRAFT_KEY = 'draft:proforma:new';

// Opciones de IVA por rubro. Además de 15% y 0%, se puede marcar un rubro como
// "No objeto de IVA" o "Sin IVA (exento)": no suman IVA y no muestran fila de IVA.
const VAT_OPTIONS = [
  { value: '15', label: 'IVA 15%' },
  { value: '0', label: 'IVA 0%' },
  { value: 'NO_OBJETO', label: 'No objeto de IVA' },
  { value: 'EXENTO', label: 'Sin IVA (exento)' },
];
function vatRate(mode: string): number {
  if (mode === '0' || mode === 'NO_OBJETO' || mode === 'EXENTO') return 0;
  const n = Number(mode);
  return Number.isFinite(n) ? n : 0;
}
function vatLabel(mode: string): string {
  if (mode === 'NO_OBJETO') return 'No objeto de IVA';
  if (mode === 'EXENTO') return 'Exento de IVA';
  return `${vatRate(mode)}%`;
}
function vatHasIvaLine(mode: string): boolean {
  return mode !== 'NO_OBJETO' && mode !== 'EXENTO';
}
// Reconstruye el modo a partir de los campos guardados (edición/borrador).
function vatModeFrom(
  vatPercent: number | string | null | undefined,
  vatType: string | null | undefined,
  fallback: string,
): string {
  if (vatType === 'NO_OBJETO' || vatType === 'EXENTO') return vatType;
  if (vatPercent == null || vatPercent === '') return fallback;
  return String(vatPercent);
}

interface ImageItem {
  preview: string; // base64 data URL
  dataBase64: string; // sin prefix
  mimeType: string;
  filename: string;
  caption: string;
}

interface Item {
  quantity: string;
  unit: string;
  description: string;
  unitPrice: string;
  vatMode: string; // IVA de este rubro: '15' | '0' | 'NO_OBJETO' | 'EXENTO'
  itemImages: ImageItem[]; // imágenes del rubro (salen al lado de la descripción, hasta 3)
}

// Datos completos de una proforma para editarla (GET /proformas/:id).
export interface ProformaEditData {
  id: string;
  date: string;
  clientId: string | null;
  clientName: string;
  clientRuc: string | null;
  clientAddress: string | null;
  clientResponsible: string | null;
  projectId: string | null;
  projectLabel: string | null;
  ivaPercent: number;
  creditTerm: string | null;
  paymentTerms: string | null;
  validity: string | null;
  deliveryTime: string | null;
  topClients: string | null;
  signerName: string | null;
  signerTitle: string | null;
  items: Array<{
    quantity: number;
    unit: string;
    description: string;
    unitPrice: number;
    vatPercent?: number | null;
    vatType?: string | null;
  }>;
  images: Array<{
    id: string;
    mimeType: string;
    caption: string | null;
    filename: string | null;
    itemIndex: number | null;
  }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: ProformaEditData | null; // si viene → edición
  onCreated: (id: string) => void;
}

const DEFAULT_TOP_CLIENTS = `GAD Canton El Empalme.
Ambiesa S.A.
Ministerio de Educación, coordinacion zonal`;

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4 MB por imagen
const MAX_IMAGES = 6;
const MAX_ITEM_IMAGES = 3; // imágenes por rubro (el PDF las dibuja al lado, hasta 3)

function fileToBase64(file: File): Promise<{ dataUrl: string; dataBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const dataBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
      resolve({ dataUrl, dataBase64 });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function CreateProformaModal({ open, onClose, initial, onCreated }: Props) {
  const isEdit = !!initial;
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [clientId, setClientId] = useState('');
  const [showCreateClient, setShowCreateClient] = useState(false);
  // Índice del ítem para el que se está creando un producto nuevo (o null).
  const [productModalFor, setProductModalFor] = useState<number | null>(null);
  // snapshots editables del cliente (precargados al elegir uno)
  const [clientName, setClientName] = useState('');
  const [clientRuc, setClientRuc] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientResponsible, setClientResponsible] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projectLabel, setProjectLabel] = useState('');
  const [ivaPercent, setIvaPercent] = useState('15');
  const [creditTerm, setCreditTerm] = useState('30 días');
  const [paymentTerms, setPaymentTerms] = useState('100% contraentrega');
  const [validity, setValidity] = useState('10 días');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [topClients, setTopClients] = useState(DEFAULT_TOP_CLIENTS);
  const [signerName, setSignerName] = useState('Gabriel Constantine L.');
  const [signerTitle, setSignerTitle] = useState('Gerente General');
  const [items, setItems] = useState<Item[]>([
    { quantity: '1', unit: 'GBL', description: '', unitPrice: '', vatMode: '15', itemImages: [] },
  ]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: clients, mutate: mutateClients } = useSWR<Client[]>('/clients', apiGet);
  const { data: projects } = useSWR<Project[]>('/projects', apiGet);
  const { data: products, mutate: mutateProducts } = useSWR<Product[]>('/products', apiGet);
  const [notice, setNotice] = useState<string | null>(null);
  // Mientras se recuperan las imágenes existentes (edición), bloqueamos el guardar
  // para no perderlas si el usuario guarda demasiado rápido.
  const [imagesLoading, setImagesLoading] = useState(false);

  // ----- Borrador automático (solo al crear, no al editar) -----
  const [draftDismissed, setDraftDismissed] = useState(false);
  const hasContent =
    clientName.trim() !== '' ||
    projectLabel.trim() !== '' ||
    items.some((it) => it.description.trim() !== '' || it.unitPrice.trim() !== '');
  // Lo que se guarda en el borrador (sin imágenes; solo texto e ítems).
  const draftValue = useMemo(
    () => ({
      date,
      clientId,
      clientName,
      clientRuc,
      clientAddress,
      clientResponsible,
      projectId,
      projectLabel,
      ivaPercent,
      creditTerm,
      paymentTerms,
      validity,
      deliveryTime,
      topClients,
      signerName,
      signerTitle,
      items: items.map((it) => ({
        quantity: it.quantity,
        unit: it.unit,
        description: it.description,
        unitPrice: it.unitPrice,
        vatMode: it.vatMode,
      })),
    }),
    [
      date,
      clientId,
      clientName,
      clientRuc,
      clientAddress,
      clientResponsible,
      projectId,
      projectLabel,
      ivaPercent,
      creditTerm,
      paymentTerms,
      validity,
      deliveryTime,
      topClients,
      signerName,
      signerTitle,
      items,
    ],
  );
  type DraftValue = typeof draftValue;
  const { available: draft, clear: clearDraft } = useDraft<DraftValue>(
    DRAFT_KEY,
    draftValue,
    open && !isEdit,
    open && !isEdit && hasContent,
  );

  function restoreDraft() {
    if (!draft) return;
    setDate(draft.date ?? new Date().toISOString().slice(0, 10));
    setClientId(draft.clientId ?? '');
    setClientName(draft.clientName ?? '');
    setClientRuc(draft.clientRuc ?? '');
    setClientAddress(draft.clientAddress ?? '');
    setClientResponsible(draft.clientResponsible ?? '');
    setProjectId(draft.projectId ?? '');
    setProjectLabel(draft.projectLabel ?? '');
    setIvaPercent(draft.ivaPercent ?? '15');
    setCreditTerm(draft.creditTerm ?? '');
    setPaymentTerms(draft.paymentTerms ?? '');
    setValidity(draft.validity ?? '');
    setDeliveryTime(draft.deliveryTime ?? '');
    setTopClients(draft.topClients ?? DEFAULT_TOP_CLIENTS);
    setSignerName(draft.signerName ?? '');
    setSignerTitle(draft.signerTitle ?? '');
    setItems(
      draft.items && draft.items.length > 0
        ? draft.items.map((it) => ({ ...it, vatMode: it.vatMode ?? '15', itemImages: [] }))
        : [{ quantity: '1', unit: 'GBL', description: '', unitPrice: '', vatMode: '15', itemImages: [] }],
    );
    setDraftDismissed(true);
  }

  useEffect(() => {
    if (!open) return;
    setNotice(null);
    setError(null);
    setImagesLoading(false);
    setDraftDismissed(false);
    if (initial) {
      setDate(initial.date ? initial.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setClientId(initial.clientId ?? '');
      setClientName(initial.clientName ?? '');
      setClientRuc(initial.clientRuc ?? '');
      setClientAddress(initial.clientAddress ?? '');
      setClientResponsible(initial.clientResponsible ?? '');
      setProjectId(initial.projectId ?? '');
      setProjectLabel(initial.projectLabel ?? '');
      setIvaPercent(String(initial.ivaPercent ?? 15));
      setCreditTerm(initial.creditTerm ?? '');
      setPaymentTerms(initial.paymentTerms ?? '');
      setValidity(initial.validity ?? '');
      setDeliveryTime(initial.deliveryTime ?? '');
      setTopClients(initial.topClients ?? '');
      setSignerName(initial.signerName ?? '');
      setSignerTitle(initial.signerTitle ?? '');
      setItems(
        initial.items.length > 0
          ? initial.items.map((it) => ({
              quantity: String(it.quantity),
              unit: it.unit,
              description: it.description,
              unitPrice: String(it.unitPrice),
              vatMode: vatModeFrom(it.vatPercent, it.vatType, String(initial.ivaPercent ?? 15)),
              itemImages: [],
            }))
          : [{ quantity: '1', unit: 'GBL', description: '', unitPrice: '', vatMode: '15', itemImages: [] }],
      );
      setImages([]);
      // Cargar las imágenes existentes (binario) para no perderlas al guardar.
      void loadInitialImages(initial);
      return;
    }
    setDate(new Date().toISOString().slice(0, 10));
    setClientId('');
    setClientName('');
    setClientRuc('');
    setClientAddress('');
    setClientResponsible('');
    setProjectId('');
    setProjectLabel('');
    setIvaPercent('15');
    setCreditTerm('30 días');
    setPaymentTerms('100% contraentrega');
    setValidity('10 días');
    setDeliveryTime('');
    setTopClients(DEFAULT_TOP_CLIENTS);
    setSignerName('Gabriel Constantine L.');
    setSignerTitle('Gerente General');
    setItems([{ quantity: '1', unit: 'GBL', description: '', unitPrice: '', vatMode: '15', itemImages: [] }]);
    setImages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  // Trae el binario de cada imagen existente y la reasigna a su rubro (itemIndex)
  // o a las imágenes generales.
  async function loadInitialImages(p: ProformaEditData) {
    if (!p.images || p.images.length === 0) return;
    setImagesLoading(true);
    try {
    for (const img of p.images) {
      try {
        const blob = await apiFetchBlob(`/proformas/${p.id}/images/${img.id}`);
        const dataUrl = await blobToDataUrl(blob);
        const imageItem: ImageItem = {
          preview: dataUrl,
          dataBase64: dataUrl.replace(/^data:[^;]+;base64,/, ''),
          mimeType: blob.type || img.mimeType || 'image/png',
          filename: img.filename ?? '',
          caption: img.caption ?? '',
        };
        if (img.itemIndex != null) {
          const ti = img.itemIndex;
          setItems((curr) =>
            curr.map((it, i) =>
              i === ti ? { ...it, itemImages: [...it.itemImages, imageItem] } : it,
            ),
          );
        } else {
          setImages((curr) => [...curr, imageItem]);
        }
      } catch {
        /* si una imagen falla, seguimos con el resto */
      }
    }
    } finally {
      setImagesLoading(false);
    }
  }

  // Cuando el usuario elige un cliente, pre-llenar campos
  function selectClient(id: string) {
    setClientId(id);
    const c = clients?.find((x) => x.id === id);
    if (c) {
      setClientName(c.name);
      setClientRuc(c.ruc ?? '');
      setClientAddress(c.address ?? '');
      setClientResponsible(c.responsible ?? '');
    }
  }

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((curr) => curr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  // Aplica un producto (objeto) al ítem: llena unidad, descripción y precio,
  // y copia su imagen (si tiene) para que salga al lado del rubro.
  async function applyProductObj(idx: number, prod: Product) {
    updateItem(idx, {
      unit: prod.unit,
      description: prod.description,
      unitPrice: String(prod.unitPrice),
    });
    if (prod.hasImage) {
      try {
        const blob = await apiFetchBlob(`/products/${prod.id}/image`);
        const dataUrl = await blobToDataUrl(blob);
        const img: ImageItem = {
          preview: dataUrl,
          dataBase64: dataUrl.replace(/^data:[^;]+;base64,/, ''),
          mimeType: blob.type || prod.imageMime || 'image/png',
          filename: prod.name,
          caption: '',
        };
        // La imagen del producto se agrega a las del rubro.
        setItems((curr) =>
          curr.map((it, i) => (i === idx ? { ...it, itemImages: [...it.itemImages, img] } : it)),
        );
      } catch {
        /* si falla la imagen, igual queda el ítem con sus datos */
      }
    }
  }

  // Elegir un producto guardado del selector.
  async function applyProduct(idx: number, productId: string) {
    const prod = products?.find((p) => p.id === productId);
    if (prod) await applyProductObj(idx, prod);
  }

  // Guardar el ítem actual como producto reutilizable (solo cuando el usuario lo pide).
  async function saveItemAsProduct(idx: number) {
    const it = items[idx];
    if (!it.description.trim()) {
      setError('El ítem necesita una descripción para guardarlo como producto.');
      return;
    }
    try {
      await apiPost('/products', {
        name: it.description.trim().slice(0, 200),
        unit: it.unit || 'U',
        description: it.description.trim(),
        unitPrice: Number(it.unitPrice) || 0,
      });
      await mutateProducts();
      setNotice('✓ Guardado en el catálogo de productos.');
      setTimeout(() => setNotice(null), 2500);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo guardar el producto');
    }
  }
  function addItem() {
    setItems((c) => [
      ...c,
      { quantity: '1', unit: 'GBL', description: '', unitPrice: '', vatMode: ivaPercent, itemImages: [] },
    ]);
  }
  function removeItem(idx: number) {
    setItems((c) => (c.length === 1 ? c : c.filter((_, i) => i !== idx)));
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    if (images.length + files.length > MAX_IMAGES) {
      setError(`Solo puedes adjuntar hasta ${MAX_IMAGES} imágenes.`);
      return;
    }
    const added: ImageItem[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > MAX_IMAGE_SIZE) {
        setError(`"${f.name}" pesa más de 4 MB. Reduce el tamaño y vuelve a intentar.`);
        continue;
      }
      const { dataUrl, dataBase64 } = await fileToBase64(f);
      added.push({ preview: dataUrl, dataBase64, mimeType: f.type, filename: f.name, caption: '' });
    }
    setImages((c) => [...c, ...added]);
  }

  function removeImage(idx: number) {
    setImages((c) => c.filter((_, i) => i !== idx));
  }

  // Imágenes ligadas a un rubro (salen al lado de su descripción en el PDF).
  // Se pueden agregar varias (hasta MAX_ITEM_IMAGES).
  async function attachItemImages(idx: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    const current = items[idx]?.itemImages.length ?? 0;
    const room = MAX_ITEM_IMAGES - current;
    if (room <= 0) {
      setError(`Cada rubro admite hasta ${MAX_ITEM_IMAGES} imágenes.`);
      return;
    }
    const added: ImageItem[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > MAX_IMAGE_SIZE) {
        setError(`"${file.name}" pesa más de 4 MB. Reduce el tamaño y vuelve a intentar.`);
        continue;
      }
      const { dataUrl, dataBase64 } = await fileToBase64(file);
      added.push({ preview: dataUrl, dataBase64, mimeType: file.type, filename: file.name, caption: '' });
    }
    if (added.length === 0) return;
    setItems((curr) =>
      curr.map((it, i) => (i === idx ? { ...it, itemImages: [...it.itemImages, ...added] } : it)),
    );
  }

  function removeItemImage(itemIdx: number, imgIdx: number) {
    setItems((curr) =>
      curr.map((it, i) =>
        i === itemIdx ? { ...it, itemImages: it.itemImages.filter((_, k) => k !== imgIdx) } : it,
      ),
    );
  }

  function updateItemImageCaption(itemIdx: number, imgIdx: number, caption: string) {
    setItems((curr) =>
      curr.map((it, i) =>
        i === itemIdx
          ? {
              ...it,
              itemImages: it.itemImages.map((im, k) => (k === imgIdx ? { ...im, caption } : im)),
            }
          : it,
      ),
    );
  }

  // Totales con IVA POR RUBRO: agrupamos por categoría (15%, 0%, No objeto, Exento).
  const vatBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { mode: string; label: string; rate: number; ivaLine: boolean; base: number; iva: number }
    >();
    for (const it of items) {
      const mode = it.vatMode || ivaPercent || '0';
      const rate = vatRate(mode);
      const ivaLine = vatHasIvaLine(mode);
      const key = mode === 'NO_OBJETO' || mode === 'EXENTO' ? mode : `R${rate}`;
      const base = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
      const ex = map.get(key);
      if (ex) {
        ex.base += base;
        ex.iva += (base * rate) / 100;
      } else {
        map.set(key, { mode, label: vatLabel(mode), rate, ivaLine, base, iva: (base * rate) / 100 });
      }
    }
    const ord = (r: { rate: number; ivaLine: boolean; mode: string }) =>
      r.ivaLine ? 100 - r.rate : r.mode === 'NO_OBJETO' ? 200 : 300;
    return Array.from(map.values()).sort((a, b) => ord(a) - ord(b));
  }, [items, ivaPercent]);
  const subtotal = vatBreakdown.reduce((s, b) => s + b.base, 0);
  const iva = vatBreakdown.reduce((s, b) => s + b.iva, 0);
  const total = subtotal + iva;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) {
      setError('Selecciona o crea un cliente.');
      return;
    }
    if (items.some((it) => !it.description.trim())) {
      setError('Todos los ítems necesitan una descripción.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        date,
        clientId: clientId || undefined,
        clientName,
        clientRuc: clientRuc || undefined,
        clientAddress: clientAddress || undefined,
        clientResponsible: clientResponsible || undefined,
        projectId: projectId || undefined,
        projectLabel: projectLabel || undefined,
        ivaPercent: Number(ivaPercent),
        creditTerm,
        paymentTerms,
        validity,
        deliveryTime,
        topClients,
        signerName,
        signerTitle,
        items: items.map((it) => ({
          quantity: Number(it.quantity),
          unit: it.unit,
          description: it.description,
          unitPrice: Number(it.unitPrice),
          vatPercent: vatRate(it.vatMode),
          vatType:
            it.vatMode === 'NO_OBJETO' || it.vatMode === 'EXENTO' ? it.vatMode : null,
        })),
        images: [
          // Imágenes ligadas a un rubro (van al lado de su descripción). Varias por rubro.
          ...items.flatMap((it, idx) =>
            it.itemImages.map((img) => ({
              mimeType: img.mimeType,
              dataBase64: img.dataBase64,
              filename: img.filename,
              caption: img.caption || undefined,
              itemIndex: idx,
            })),
          ),
          // Imágenes generales (sin rubro) → al final del PDF.
          ...images.map((img) => ({
            mimeType: img.mimeType,
            dataBase64: img.dataBase64,
            filename: img.filename,
            caption: img.caption || undefined,
          })),
        ],
      };
      if (isEdit && initial) {
        await apiPatch(`/proformas/${initial.id}`, payload);
        onCreated(initial.id);
      } else {
        const created = (await apiPost<{ id: string }>('/proformas', payload)) as { id: string };
        onCreated(created.id);
      }
      clearDraft(); // se guardó OK → ya no hace falta el borrador
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : isEdit
            ? 'Error al guardar la proforma'
            : 'Error al crear la proforma',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar proforma' : 'Nueva proforma'}
      width="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && draft && !draftDismissed && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs">
            <span className="text-ink-primary">
              💾 Tienes un <strong>borrador</strong> de una proforma sin terminar. ¿Lo recuperas?
            </span>
            <span className="flex gap-2">
              <button type="button" onClick={restoreDraft} className="btn-primary px-3 py-1 text-xs">
                Recuperar
              </button>
              <button
                type="button"
                onClick={() => {
                  clearDraft();
                  setDraftDismissed(true);
                }}
                className="btn-secondary px-3 py-1 text-xs"
              >
                Descartar
              </button>
            </span>
          </div>
        )}

        {/* Cliente */}
        <div className="rounded-lg border border-surface-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Cliente
            </div>
            <button
              type="button"
              onClick={() => setShowCreateClient(true)}
              className="btn-secondary text-xs"
            >
              + Nuevo cliente
            </button>
          </div>
          <Field label="Cliente guardado" hint="O escribe los datos manualmente abajo">
            <select
              value={clientId}
              onChange={(e) => selectClient(e.target.value)}
              className="input"
            >
              <option value="">— Sin cliente guardado (escribir manual) —</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.ruc ? ` · RUC ${c.ruc}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <div className="mt-3 space-y-3">
            <Field label="Nombre / razón social" required>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                className="input"
                placeholder="IGLESIA DE JESUCRISTO…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="RUC">
                <input value={clientRuc} onChange={(e) => setClientRuc(e.target.value)} className="input" />
              </Field>
              <Field label="Responsable">
                <input
                  value={clientResponsible}
                  onChange={(e) => setClientResponsible(e.target.value)}
                  className="input"
                />
              </Field>
            </div>
            <Field label="Dirección">
              <input
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                className="input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Proyecto interno (opcional)">
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="input"
                >
                  <option value="">— Sin proyecto —</option>
                  {projects?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Etiqueta del proyecto (texto)">
                <input
                  value={projectLabel}
                  onChange={(e) => setProjectLabel(e.target.value)}
                  className="input"
                  placeholder="MAPASINGUE"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Ítems */}
        <div className="rounded-lg border border-surface-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Ítems
            </div>
            <button type="button" onClick={addItem} className="btn-secondary text-xs">
              + Añadir línea
            </button>
          </div>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div
                key={idx}
                className="rounded-md border border-surface-border bg-surface-muted/30 p-2"
              >
                <div className="mb-2 flex items-center gap-2">
                  {products && products.length > 0 && (
                    <div className="min-w-0 flex-1">
                      <SearchableSelect
                        value=""
                        onChange={(v) => applyProduct(idx, v)}
                        placeholder="📦 Usar un producto guardado…"
                        options={products.map((p) => ({
                          value: p.id,
                          label: `${p.description.slice(0, 70)} · ${formatCurrency(p.unitPrice)}`,
                        }))}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setProductModalFor(idx)}
                    className="btn-secondary shrink-0 whitespace-nowrap text-xs"
                    title="Crear un producto nuevo y usarlo en este rubro"
                  >
                    ➕ Nuevo producto
                  </button>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <input
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                    className="input col-span-3"
                    placeholder="Cant"
                    type="number"
                    step="0.01"
                    min="0"
                  />
                  <input
                    value={it.unit}
                    onChange={(e) => updateItem(idx, { unit: e.target.value })}
                    className="input col-span-3"
                    placeholder="UNI"
                  />
                  <input
                    value={it.unitPrice}
                    onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                    className="input col-span-5"
                    placeholder="V. Unit"
                    type="number"
                    step="0.01"
                    min="0"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                    className="col-span-1 rounded-md text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger disabled:opacity-30"
                    title="Eliminar línea"
                  >
                    🗑️
                  </button>
                </div>
                {/* Descripción: textarea → se puede dar Enter para varias líneas
                    dentro del MISMO rubro (sale con saltos de línea en el PDF/Excel). */}
                <textarea
                  value={it.description}
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                  className="input mt-2 w-full"
                  placeholder="Descripción del rubro — puedes dar Enter para poner varias líneas"
                  rows={2}
                  required
                />

                {/* IVA de este rubro */}
                <div className="mt-2 flex items-center gap-2 text-xs text-ink-secondary">
                  <span>IVA de este rubro:</span>
                  <select
                    value={it.vatMode}
                    onChange={(e) => updateItem(idx, { vatMode: e.target.value })}
                    className="input w-44 py-1 text-xs"
                  >
                    {VAT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                    {!VAT_OPTIONS.some((o) => o.value === it.vatMode) && (
                      <option value={it.vatMode}>IVA {vatRate(it.vatMode)}%</option>
                    )}
                  </select>
                </div>

                {/* Imágenes del rubro — salen al lado de la descripción en el PDF (varias) */}
                <div className="mt-2">
                  {it.itemImages.length > 0 && (
                    <div className="mb-2 space-y-1.5">
                      {it.itemImages.map((img, imgIdx) => (
                        <div key={imgIdx} className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.preview}
                            alt={img.filename}
                            className="h-12 w-12 shrink-0 rounded border border-surface-border object-cover"
                          />
                          <input
                            value={img.caption}
                            onChange={(e) => updateItemImageCaption(idx, imgIdx, e.target.value)}
                            placeholder="Pie de foto (opcional)"
                            className="input flex-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => removeItemImage(idx, imgIdx)}
                            className="shrink-0 text-xs text-ink-secondary hover:text-danger"
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {it.itemImages.length < MAX_ITEM_IMAGES && (
                      <label className="btn-secondary cursor-pointer text-xs">
                        📷 {it.itemImages.length === 0 ? 'Imagen del rubro' : 'Añadir otra imagen'}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => attachItemImages(idx, e.target.files)}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => saveItemAsProduct(idx)}
                      className="ml-auto shrink-0 text-xs text-ink-secondary hover:text-brand"
                      title="Guardar este ítem en el catálogo para reutilizarlo"
                    >
                      💾 Guardar como producto
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {notice && <div className="text-xs font-medium text-success">{notice}</div>}
          </div>

          <div className="mt-3 flex flex-col items-end gap-1 text-sm">
            <div className="mb-1 flex items-center gap-2 text-xs text-ink-secondary">
              IVA por defecto de nuevos rubros:
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={ivaPercent}
                onChange={(e) => setIvaPercent(e.target.value)}
                className="input w-16"
              />
              %
            </div>
            {vatBreakdown.map((b) => (
              <div key={`sub-${b.mode}`}>
                SUBTOTAL {b.label}:{' '}
                <span className="font-semibold">{formatCurrency(b.base, true)}</span>
              </div>
            ))}
            {vatBreakdown
              .filter((b) => b.ivaLine)
              .map((b) => (
                <div key={`iva-${b.mode}`}>
                  IVA {b.label}:{' '}
                  <span className="font-semibold">{formatCurrency(b.iva, true)}</span>
                </div>
              ))}
            <div className="text-base">
              TOTAL:{' '}
              <span className="font-bold text-brand">{formatCurrency(total, true)}</span>
            </div>
          </div>
        </div>

        {/* Imágenes */}
        <div className="rounded-lg border border-surface-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Imágenes generales (al final del PDF, opcional)
            </div>
            <label className="btn-secondary cursor-pointer text-xs">
              + Subir imagen
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
              />
            </label>
          </div>
          <p className="mb-2 text-[11px] text-ink-tertiary">
            Para poner una imagen <strong>al lado de un rubro</strong>, usa el botón “📷 Imagen del
            rubro” en cada ítem. Estas de aquí son imágenes generales: hasta {MAX_IMAGES}, máximo 4
            MB cada una, aparecen al final del PDF.
          </p>
          {images.length === 0 ? (
            <div className="rounded-md border border-dashed border-surface-border bg-surface-muted/30 px-3 py-6 text-center text-xs text-ink-secondary">
              Sin imágenes adjuntas
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {images.map((img, idx) => (
                <div key={idx} className="rounded-md border border-surface-border bg-surface p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.preview}
                    alt={img.filename}
                    className="h-24 w-full rounded object-cover"
                  />
                  <input
                    value={img.caption}
                    onChange={(e) =>
                      setImages((c) =>
                        c.map((x, i) => (i === idx ? { ...x, caption: e.target.value } : x)),
                      )
                    }
                    placeholder="Pie de foto (opcional)"
                    className="input mt-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="mt-1 w-full text-xs text-ink-secondary hover:text-danger"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Condiciones */}
        <div className="rounded-lg border border-surface-border p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
            Condiciones comerciales
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plazo de crédito">
              <input value={creditTerm} onChange={(e) => setCreditTerm(e.target.value)} className="input" />
            </Field>
            <Field label="Forma de pago">
              <input
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Vigencia">
              <input value={validity} onChange={(e) => setValidity(e.target.value)} className="input" />
            </Field>
            <Field label="Tiempo de entrega">
              <input
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                className="input"
                placeholder="Ej. 15 días laborables"
              />
            </Field>
          </div>
          <Field label="Principales clientes (uno por línea)">
            <textarea
              value={topClients}
              onChange={(e) => setTopClients(e.target.value)}
              rows={3}
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre del firmante">
              <input value={signerName} onChange={(e) => setSignerName(e.target.value)} className="input" />
            </Field>
            <Field label="Cargo">
              <input value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} className="input" />
            </Field>
          </div>
        </div>

        <Field label="Fecha de emisión">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </Field>

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || imagesLoading}
            className="btn-primary disabled:opacity-50"
          >
            {imagesLoading
              ? 'Cargando imágenes…'
              : submitting
                ? 'Guardando…'
                : isEdit
                  ? 'Guardar cambios'
                  : 'Crear proforma'}
          </button>
        </div>
      </form>

      <CreateClientModal
        open={showCreateClient}
        onClose={() => setShowCreateClient(false)}
        onSaved={(c) => {
          mutateClients();
          selectClient(c.id);
        }}
      />

      {/* Crear un producto nuevo desde un rubro y usarlo de inmediato. */}
      <CreateProductModal
        open={productModalFor !== null}
        onClose={() => setProductModalFor(null)}
        onSaved={(created) => {
          void mutateProducts();
          if (created && productModalFor !== null) {
            void applyProductObj(productModalFor, created);
          }
          setProductModalFor(null);
        }}
      />
    </Modal>
  );
}
