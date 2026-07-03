/**
 * Totales de una proforma con IVA POR RUBRO. Cada ítem puede tener su propio
 * IVA. Modos soportados por rubro:
 *   - Un porcentaje normal (15, 0, …) vía `vatPercent` (null = IVA general).
 *   - `vatType = 'NO_OBJETO'`  → No objeto de IVA (no suma IVA, sin fila de IVA).
 *   - `vatType = 'EXENTO'`     → Exento / Sin IVA  (no suma IVA, sin fila de IVA).
 * Devuelve el desglose por categoría (SUBTOTAL 15%, SUBTOTAL 0%, SUBTOTAL
 * No objeto de IVA, …) con su etiqueta y si lleva o no fila de "IVA …".
 */
export interface VatRow {
  mode: string; // clave interna de agrupación
  label: string; // '15%', '0%', 'No objeto de IVA', 'Exento de IVA'
  rate: number; // tarifa numérica (0 para los especiales)
  ivaLine: boolean; // si se muestra la fila "IVA <label>"
  base: number; // suma de bases (sin IVA)
  iva: number; // IVA de esta categoría
}

export interface ProformaTotals {
  subtotal: number; // suma de todas las bases (sin IVA)
  iva: number; // suma de todos los IVA
  total: number;
  breakdown: VatRow[];
}

interface ItemLike {
  quantity: number;
  unitPrice: number;
  vatPercent?: number | null;
  vatType?: string | null;
}

function resolveMode(
  it: ItemLike,
  defaultIva: number,
): { mode: string; label: string; rate: number; ivaLine: boolean } {
  const t = (it.vatType ?? '').toUpperCase();
  if (t === 'NO_OBJETO')
    return { mode: 'NO_OBJETO', label: 'No objeto de IVA', rate: 0, ivaLine: false };
  if (t === 'EXENTO') return { mode: 'EXENTO', label: 'Exento de IVA', rate: 0, ivaLine: false };
  const rate = it.vatPercent == null ? defaultIva : Number(it.vatPercent);
  return { mode: `R${rate}`, label: `${rate}%`, rate, ivaLine: true };
}

// Orden de aparición: 15% antes que 0%, y los especiales al final.
function ord(r: { rate: number; ivaLine: boolean; mode: string }): number {
  if (r.ivaLine) return 100 - r.rate; // 15%→85, 0%→100
  if (r.mode === 'NO_OBJETO') return 200;
  return 300; // EXENTO
}

export function computeProformaTotals(items: ItemLike[], defaultIva: number): ProformaTotals {
  const map = new Map<string, VatRow>();
  for (const it of items) {
    const m = resolveMode(it, defaultIva);
    const base = Number(it.quantity) * Number(it.unitPrice);
    const iva = base * (m.rate / 100);
    const existing = map.get(m.mode);
    if (existing) {
      existing.base += base;
      existing.iva += iva;
    } else {
      map.set(m.mode, { ...m, base, iva });
    }
  }
  const breakdown = Array.from(map.values()).sort((a, b) => ord(a) - ord(b));
  const subtotal = breakdown.reduce((s, b) => s + b.base, 0);
  const iva = breakdown.reduce((s, b) => s + b.iva, 0);
  return { subtotal, iva, total: subtotal + iva, breakdown };
}
