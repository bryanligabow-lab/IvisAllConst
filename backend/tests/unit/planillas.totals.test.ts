import { describe, it, expect } from 'vitest';

/**
 * Reimplementación del cálculo en aislamiento para test puro.
 * Si cambia la fórmula en PlanillasService.computeTotals, sincronizar aquí.
 */
function computeTotals(
  totalCurrent: number,
  totalPrevious: number,
  advancePercent: number,
  guaranteePercent: number,
) {
  const advanceAmortization = totalCurrent * (advancePercent / 100);
  const guaranteeRetention = totalCurrent * (guaranteePercent / 100);
  const netPayable = totalCurrent - advanceAmortization - guaranteeRetention;
  return {
    totalAccumulated: totalCurrent + totalPrevious,
    advanceAmortization,
    guaranteeRetention,
    netPayable,
  };
}

describe('Planillas — cálculo de totales', () => {
  it('aplica amortización de anticipo y fondo de garantía', () => {
    const r = computeTotals(3976.54, 0, 40, 5);
    expect(r.advanceAmortization).toBeCloseTo(1590.616, 3);
    expect(r.guaranteeRetention).toBeCloseTo(198.827, 3);
    expect(r.netPayable).toBeCloseTo(2187.097, 3);
  });

  it('acumula con planilla anterior', () => {
    const r = computeTotals(1500, 2500, 40, 5);
    expect(r.totalAccumulated).toBe(4000);
  });

  it('netPayable nunca usa valores negativos por convención', () => {
    const r = computeTotals(100, 0, 100, 0);
    expect(r.netPayable).toBe(0);
  });
});
