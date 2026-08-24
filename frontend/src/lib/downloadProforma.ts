import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';

// Saca el nombre del archivo del header Content-Disposition (lo arma el backend
// e incluye el proyecto). Si no se puede leer, usa el fallback.
export function filenameFromDisposition(cd: string | null, fallback: string): string {
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

/**
 * Descarga la proforma en PDF o Excel. Se usa tanto en el detalle como en el
 * listado (botón de descarga directa, sin abrir la proforma).
 */
export async function downloadProforma(
  id: string,
  format: 'pdf' | 'xlsx',
  number: string,
  projectLabel?: string | null,
): Promise<void> {
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
