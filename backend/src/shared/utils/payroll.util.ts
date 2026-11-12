/**
 * Cálculo de un pago de nómina según la ley ecuatoriana.
 *
 * Horas extras (Código del Trabajo):
 *   - valor de la hora  = sueldo mensual / 240  (8 h × 30 días)
 *   - hora SUPLEMENTARIA = valor hora × 1,50   (recargo del 50 %)
 *   - hora EXTRAORDINARIA = valor hora × 2,00  (recargo del 100 %:
 *     sábados, domingos, feriados y de 24:00 a 06:00)
 *
 * Fondos de reserva: 8,33 % (un doceavo) de la remuneración de aportación.
 * Aporte personal al IESS: 9,45 % de la misma base.
 *
 * La base de los dos porcentajes es el sueldo MÁS las horas extras, que es
 * la "materia gravada" del IESS. Si alguna vez se quiere aplicar solo sobre
 * el sueldo, se cambia `baseAportacion`.
 */
export const HORAS_MES = 240;
export const RECARGO_SUPLEMENTARIA = 1.5;
export const RECARGO_EXTRAORDINARIA = 2;
export const PORCENTAJE_FONDOS_RESERVA = 0.0833;
export const PORCENTAJE_APORTE_IESS = 0.0945;

/** Cada cuánto se le paga a la persona. El sueldo guardado es siempre el mensual. */
export type FrecuenciaPago = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

/**
 * Parte del sueldo mensual que corresponde a un período de pago.
 * Se usa el día de sueldo = mensual / 30 (criterio del Código del Trabajo),
 * así que la semana son 7 días y la quincena, 15.
 */
export const FACTOR_PERIODO: Record<FrecuenciaPago, number> = {
  WEEKLY: 7 / 30,
  BIWEEKLY: 15 / 30,
  MONTHLY: 1,
};

export const ETIQUETA_FRECUENCIA: Record<FrecuenciaPago, string> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quincenal',
  MONTHLY: 'Mensual',
};

export function esFrecuencia(v: unknown): v is FrecuenciaPago {
  return v === 'WEEKLY' || v === 'BIWEEKLY' || v === 'MONTHLY';
}

/** Lo que le toca de sueldo en un período, según su frecuencia de pago. */
export function sueldoDelPeriodo(monthlySalary: number, frecuencia: FrecuenciaPago): number {
  return Math.round(Math.max(0, Number(monthlySalary) || 0) * FACTOR_PERIODO[frecuencia] * 100) / 100;
}

export interface NominaInput {
  /** Sueldo que le toca EN ESTE PERÍODO (ver `sueldoDelPeriodo`). */
  baseSalary: number;
  /**
   * Sueldo MENSUAL, solo para el valor de la hora extra (mensual / 240).
   * La hora no cambia porque se le pague semanal o quincenal. Si no se manda,
   * se asume que `baseSalary` ya es el mensual (comportamiento anterior).
   */
  monthlySalary?: number;
  /** Horas suplementarias trabajadas (recargo 50 %). */
  supplementaryHours?: number;
  /** Horas extraordinarias trabajadas (recargo 100 %). */
  extraordinaryHours?: number;
  /** ¿Se le suman los fondos de reserva este mes? */
  reserveFunds?: boolean;
  /** ¿Está afiliado al IESS? (se le descuenta el aporte personal) */
  iessAffiliated?: boolean;
  /** Anticipos entregados que se descuentan en este rol. */
  advances?: number;
  /** Otros descuentos (préstamos, multas…). */
  otherDeductions?: number;
}

export interface NominaBreakdown {
  baseSalary: number;
  hourValue: number;
  supplementaryHours: number;
  supplementaryAmount: number;
  extraordinaryHours: number;
  extraordinaryAmount: number;
  /** Sueldo + horas extras: la base sobre la que corren los porcentajes. */
  baseAportacion: number;
  reserveFundsAmount: number;
  iessAmount: number;
  advancesAmount: number;
  otherDeductions: number;
  /** Lo que efectivamente se le paga. */
  total: number;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function calcularNomina(input: NominaInput): NominaBreakdown {
  const baseSalary = Math.max(0, Number(input.baseSalary) || 0);
  const mensual = Math.max(0, Number(input.monthlySalary ?? input.baseSalary) || 0);
  const advances = Math.max(0, Number(input.advances) || 0);
  const supplementaryHours = Math.max(0, Number(input.supplementaryHours) || 0);
  const extraordinaryHours = Math.max(0, Number(input.extraordinaryHours) || 0);
  const otherDeductions = Math.max(0, Number(input.otherDeductions) || 0);

  // La hora extra sale SIEMPRE del sueldo mensual, no del monto del período.
  const hourValue = mensual / HORAS_MES;
  const supplementaryAmount = redondear(hourValue * RECARGO_SUPLEMENTARIA * supplementaryHours);
  const extraordinaryAmount = redondear(hourValue * RECARGO_EXTRAORDINARIA * extraordinaryHours);
  const baseAportacion = redondear(baseSalary + supplementaryAmount + extraordinaryAmount);

  const reserveFundsAmount = input.reserveFunds
    ? redondear(baseAportacion * PORCENTAJE_FONDOS_RESERVA)
    : 0;
  const iessAmount = input.iessAffiliated
    ? redondear(baseAportacion * PORCENTAJE_APORTE_IESS)
    : 0;

  return {
    baseSalary: redondear(baseSalary),
    hourValue: redondear(hourValue),
    supplementaryHours,
    supplementaryAmount,
    extraordinaryHours,
    extraordinaryAmount,
    baseAportacion,
    reserveFundsAmount,
    iessAmount,
    advancesAmount: redondear(advances),
    otherDeductions: redondear(otherDeductions),
    total: redondear(
      baseAportacion + reserveFundsAmount - iessAmount - advances - otherDeductions,
    ),
  };
}

/** Resumen en una línea, para la descripción del gasto y el historial. */
export function resumenNomina(b: NominaBreakdown): string {
  const m = (n: number) => `$${n.toFixed(2)}`;
  const partes = [`sueldo ${m(b.baseSalary)}`];
  if (b.supplementaryHours > 0) {
    partes.push(`${b.supplementaryHours} h supl. ${m(b.supplementaryAmount)}`);
  }
  if (b.extraordinaryHours > 0) {
    partes.push(`${b.extraordinaryHours} h extraord. ${m(b.extraordinaryAmount)}`);
  }
  if (b.reserveFundsAmount > 0) partes.push(`fondos de reserva ${m(b.reserveFundsAmount)}`);
  if (b.iessAmount > 0) partes.push(`− IESS ${m(b.iessAmount)}`);
  if (b.advancesAmount > 0) partes.push(`− anticipos ${m(b.advancesAmount)}`);
  if (b.otherDeductions > 0) partes.push(`− otros ${m(b.otherDeductions)}`);
  return partes.join(' · ');
}
