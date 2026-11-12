import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { textoParaPdf } from '../../shared/utils/text.util';
import {
  ETIQUETA_FRECUENCIA,
  esFrecuencia,
  type NominaBreakdown,
} from '../../shared/utils/payroll.util';

const RED = '#C73E2C';
const DARK = '#1A1A1A';
const GRAY = '#5C5C5C';
const LINE = '#E5E1DC';
const SOFT = '#FCEDEA';

const LOGO_PATH = path.resolve(__dirname, '../../../assets/logo-creacom.png');

function money(n: number): string {
  return '$' + (Number(n) || 0).toLocaleString('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fechaLarga(d: Date): string {
  return new Date(d).toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** El período tal como se guardó ("2026-11") pasado a algo legible. */
function periodoLegible(valor: unknown): string {
  const t = String(valor ?? '');
  const m = /^(\d{4})-(\d{2})$/.exec(t);
  if (!m) return t || '—';
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${meses[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

type DetalleGuardado = Partial<NominaBreakdown> & {
  period?: string;
  payFrequency?: string;
};

/**
 * Rol de pagos de un pago de nómina ya registrado: ingresos arriba,
 * descuentos abajo y el líquido a recibir, con las firmas.
 */
export async function exportRolDePagos(gastoId: string, res: Response): Promise<void> {
  const gasto = await prisma.gasto.findFirst({
    where: { id: gastoId, deletedAt: null, kind: 'PAYROLL' },
    include: {
      employee: true,
      project: { select: { name: true, code: true } },
    },
    omit: { invoiceImageData: true },
  });
  if (!gasto) throw new NotFoundError('Pago de nómina no encontrado');

  const emp = gasto.employee;
  const d = (gasto.payrollDetail ?? {}) as DetalleGuardado;
  // Los anticipos que se descontaron en ESTE rol, para listarlos uno por uno.
  const anticipos = await prisma.employeeAdvance.findMany({
    where: { appliedGastoId: gasto.id, deletedAt: null },
    orderBy: { advanceDate: 'asc' },
  });

  const doc = new PDFDocument({
    size: 'A4',
    margin: 44,
    info: { Title: `Rol de pagos — ${emp?.fullName ?? ''}`, Author: 'CREACOM S.A.' },
  });
  const nombreArchivo = `Rol de pagos - ${textoParaPdf(emp?.fullName ?? 'empleado')} - ${periodoLegible(d.period)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo.replace(/"/g, '')}"`);
  doc.pipe(res);

  const M = 44;
  const W = doc.page.width - M * 2;

  // ---------- Membrete ----------
  if (fs.existsSync(LOGO_PATH)) {
    try {
      doc.image(LOGO_PATH, M, M - 6, { fit: [150, 70] });
    } catch {
      // sin logo, el membrete de texto igual sale
    }
  }
  doc.fillColor(RED).font('Helvetica-Bold').fontSize(18).text('ROL DE PAGOS', M, M + 4, {
    width: W,
    align: 'right',
  });
  doc.fillColor(GRAY).font('Helvetica').fontSize(9);
  doc.text('CREACOM S.A. · RUC 0993273708001', M, M + 26, { width: W, align: 'right' });
  doc.text(`Emitido el ${fechaLarga(new Date())}`, M, M + 38, { width: W, align: 'right' });

  // ---------- Datos del empleado ----------
  let y = M + 76;
  doc.moveTo(M, y).lineTo(M + W, y).lineWidth(1.5).strokeColor(RED).stroke();
  y += 10;

  const frecuencia = esFrecuencia(d.payFrequency ?? emp?.payFrequency)
    ? ETIQUETA_FRECUENCIA[(d.payFrequency ?? emp?.payFrequency) as 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY']
    : '—';

  const datos: [string, string][] = [
    ['Trabajador', textoParaPdf(emp?.fullName ?? '—')],
    ['Cédula', textoParaPdf(emp?.cedula ?? '—')],
    ['Cargo', textoParaPdf(emp?.position ?? '—')],
    ['Período', periodoLegible(d.period)],
    ['Frecuencia de pago', frecuencia],
    ['Fecha de pago', fechaLarga(gasto.gastoDate)],
    ['Proyecto', textoParaPdf(gasto.project?.name ?? '—')],
    ['Sueldo mensual', money(Number(emp?.monthlySalary ?? 0))],
  ];
  doc.fontSize(9);
  const colW = W / 2;
  datos.forEach(([k, v], i) => {
    const x = M + (i % 2) * colW;
    const fila = Math.floor(i / 2);
    const fy = y + fila * 16;
    doc.fillColor(GRAY).font('Helvetica-Bold').text(`${k}:`, x, fy, { width: 110 });
    doc.fillColor(DARK).font('Helvetica').text(v, x + 112, fy, { width: colW - 118 });
  });
  y += Math.ceil(datos.length / 2) * 16 + 14;

  // ---------- Tabla de ingresos y descuentos ----------
  const dibujarSeccion = (titulo: string, filas: [string, number][], color: string): number => {
    doc.rect(M, y, W, 20).fill(color);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10).text(titulo, M + 8, y + 6);
    doc.fillColor('#FFFFFF').text('VALOR', M + W - 108, y + 6, { width: 100, align: 'right' });
    y += 20;
    doc.font('Helvetica').fontSize(9.5);
    for (const [etiqueta, valor] of filas) {
      doc.fillColor(DARK).text(etiqueta, M + 8, y + 5, { width: W - 130 });
      doc.text(money(valor), M + W - 108, y + 5, { width: 100, align: 'right' });
      doc.moveTo(M, y + 19).lineTo(M + W, y + 19).lineWidth(0.5).strokeColor(LINE).stroke();
      y += 19;
    }
    const total = filas.reduce((s, [, v]) => s + v, 0);
    doc.rect(M, y, W, 19).fill(SOFT);
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9.5);
    doc.text(`TOTAL ${titulo}`, M + 8, y + 5, { width: W - 130 });
    doc.text(money(total), M + W - 108, y + 5, { width: 100, align: 'right' });
    y += 19 + 12;
    return total;
  };

  const ingresos: [string, number][] = [['Sueldo del período', Number(d.baseSalary ?? 0)]];
  if (Number(d.supplementaryAmount ?? 0) > 0) {
    ingresos.push([
      `Horas suplementarias (${d.supplementaryHours ?? 0} h · recargo 50 %)`,
      Number(d.supplementaryAmount),
    ]);
  }
  if (Number(d.extraordinaryAmount ?? 0) > 0) {
    ingresos.push([
      `Horas extraordinarias (${d.extraordinaryHours ?? 0} h · recargo 100 %)`,
      Number(d.extraordinaryAmount),
    ]);
  }
  if (Number(d.reserveFundsAmount ?? 0) > 0) {
    ingresos.push(['Fondos de reserva (8,33 %)', Number(d.reserveFundsAmount)]);
  }

  const descuentos: [string, number][] = [];
  if (Number(d.iessAmount ?? 0) > 0) {
    descuentos.push(['Aporte personal IESS (9,45 %)', Number(d.iessAmount)]);
  }
  for (const a of anticipos) {
    descuentos.push([
      `Anticipo del ${fechaLarga(a.advanceDate)}${a.notes ? ` — ${textoParaPdf(a.notes)}` : ''}`,
      a.amount,
    ]);
  }
  // Si el detalle trae anticipos pero no están los registros, va la suma.
  const anticiposListados = anticipos.reduce((s, a) => s + a.amount, 0);
  const anticiposDetalle = Number(d.advancesAmount ?? 0);
  if (anticiposDetalle > anticiposListados + 0.009) {
    descuentos.push(['Anticipos', anticiposDetalle - anticiposListados]);
  }
  if (Number(d.otherDeductions ?? 0) > 0) {
    descuentos.push(['Otros descuentos', Number(d.otherDeductions)]);
  }
  if (descuentos.length === 0) descuentos.push(['Sin descuentos', 0]);

  const totalIngresos = dibujarSeccion('INGRESOS', ingresos, RED);
  const totalDescuentos = dibujarSeccion('DESCUENTOS', descuentos, '#6B6B6B');

  // ---------- Líquido a recibir ----------
  const liquido = Number(gasto.amount);
  doc.rect(M, y, W, 32).fill(RED);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12);
  doc.text('LÍQUIDO A RECIBIR', M + 10, y + 10);
  doc.fontSize(15).text(money(liquido), M + W - 158, y + 8, { width: 148, align: 'right' });
  y += 44;

  // Aviso si el monto se escribió a mano y no cuadra con el desglose.
  const calculado = totalIngresos - totalDescuentos;
  if (Math.abs(calculado - liquido) > 0.02) {
    doc.fillColor(GRAY).font('Helvetica-Oblique').fontSize(8);
    doc.text(
      `El valor pagado se registró manualmente; el desglose suma ${money(calculado)}.`,
      M,
      y,
      { width: W },
    );
    y += 14;
  }

  // ---------- Firmas ----------
  y += 46;
  const anchoFirma = (W - 40) / 2;
  for (const [i, etiqueta] of ['Recibí conforme — Trabajador', 'Por CREACOM S.A.'].entries()) {
    const x = M + i * (anchoFirma + 40);
    doc.moveTo(x, y).lineTo(x + anchoFirma, y).lineWidth(0.8).strokeColor(DARK).stroke();
    doc.fillColor(GRAY).font('Helvetica').fontSize(8.5).text(etiqueta, x, y + 5, {
      width: anchoFirma,
      align: 'center',
    });
  }
  if (emp?.cedula) {
    doc.text(`C.C. ${textoParaPdf(emp.cedula)}`, M, y + 18, {
      width: anchoFirma,
      align: 'center',
    });
  }

  doc.end();
}
