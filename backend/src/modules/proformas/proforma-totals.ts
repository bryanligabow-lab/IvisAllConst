/**
 * Totales de una proforma con IVA POR RUBRO. Cada ítem puede tener su propio
 * `vatPercent` (0, 15, etc.); si es null usa el IVA general de la proforma.
 * Devuelve el desglose por tarifa (SUBTOTAL 15%, SUBTOTAL 0%, IVA 15%, …).
 */
export interface ProformaTotals {
  subtotal: number; // suma de todas las bases (sin IVA)
  iva: number; // suma de todos los IVA
  total: number;
  breakdown: Array<{ rate: number; base: number; iva: number }>;
}

export function computeProformaTotals(
  items: Array<{ quantity: number; unitPrice: number; vatPercent?: number | null }>,
  defaultIva: number,
): ProformaTotals {
  const byRate = new Map<number, number>();
  for (const it of items) {
    const rate = it.vatPercent == null ? defaultIva : Number(it.vatPercent);
    const base = Number(it.quantity) * Number(it.unitPrice);
    byRate.set(rate, (byRate.get(rate) ?? 0) + base);
  }
  const breakdown = Array.from(byRate.entries())
    .sort((a, b) => b[0] - a[0]) // 15% antes que 0%
    .map(([rate, base]) => ({ rate, base, iva: base * (rate / 100) }));
  const subtotal = breakdown.reduce((s, b) => s + b.base, 0);
  const iva = breakdown.reduce((s, b) => s + b.iva, 0);
  return { subtotal, iva, total: subtotal + iva, breakdown };
}
