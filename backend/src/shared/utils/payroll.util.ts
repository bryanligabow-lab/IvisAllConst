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

export interface NominaInput {
  /** Sueldo del período (normalmente el mensual del empleado). */
  baseSalary: number;
  /** Horas suplementarias trabajadas (recargo 50 %). */
  supplementaryHours?: number;
  /** Horas extraordinarias trabajadas (recargo 100 %). */
  extraordinaryHours?: number;
  /** ¿Se le suman los fondos de reserva este mes? */
  reserveFunds?: boolean;
  /** ¿Está afiliado al IESS? (se le descuenta el aporte personal) */
  iessAffiliated?: boolean;
  /** Otros descuentos (anticipos, préstamos…). */
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
  otherDeductions: number;
  /** Lo que efectivamente se le paga. */
  total: number;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function calcularNomina(input: NominaInput): NominaBreakdown {
  const baseSalary = Math.max(0, Number(input.baseSalary) || 0);
  const supplementaryHours = Math.max(0, Number(input.supplementaryHours) || 0);
  const extraordinaryHours = Math.max(0, Number(input.extraordinaryHours) || 0);
  const otherDeductions = Math.max(0, Number(input.otherDeductions) || 0);

  const hourValue = baseSalary / HORAS_MES;
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
    otherDeductions: redondear(otherDeductions),
    total: redondear(baseAportacion + reserveFundsAmount - iessAmount - otherDeductions),
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
  if (b.otherDeductions > 0) partes.push(`− otros ${m(b.otherDeductions)}`);
  return partes.join(' · ');
}
