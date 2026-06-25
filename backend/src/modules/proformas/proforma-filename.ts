/**
 * Nombre del archivo al exportar una proforma. Incluye el número y lo que el
 * usuario puso en "Proyecto" (projectLabel o el nombre del proyecto enlazado).
 * Ej: Proforma 001-046 - Bastion Popular.pdf
 */
// Marcas diacríticas combinantes (tildes) — se quitan para el fallback ASCII.
const DIACRITICS = /[̀-ͯ]/g;
const INVALID_FS = /[\\/:*?"<>|\r\n]+/g;

export function buildAttachment(
  p: { number: string; projectLabel?: string | null; project?: { name: string } | null },
  ext: 'pdf' | 'xlsx',
): string {
  const proyecto = (p.projectLabel || p.project?.name || '')
    .replace(INVALID_FS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const base = proyecto ? `Proforma ${p.number} - ${proyecto}` : `Proforma ${p.number}`;
  // Fallback ASCII (sin tildes) + nombre real en UTF-8 para los navegadores.
  const ascii =
    base.normalize('NFKD').replace(DIACRITICS, '').replace(/[^\x20-\x7E]/g, '').trim() ||
    `Proforma ${p.number}`;
  return `attachment; filename="${ascii}.${ext}"; filename*=UTF-8''${encodeURIComponent(base)}.${ext}`;
}
