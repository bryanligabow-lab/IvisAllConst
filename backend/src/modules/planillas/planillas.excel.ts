import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { ERRORS } from '../../shared/constants/error-messages';
import { limpiarTexto } from '../../shared/utils/text.util';

const RED = 'FFC73E2C';
const WHITE = 'FFFFFFFF';
const GRAY = 'FF5C5C5C';
const SOFT = 'FFFCEDEA';
const LINE = 'FFE5E1DC';

const LOGO_PATH = path.resolve(__dirname, '../../../assets/logo-creacom.png');

const MONEY = '"$"#,##0.00';
const QTY = '#,##0.0000';
const PCT = '0.0%';

const ESTADO: Record<string, string> = {
  DRAFT: 'Elaborándose',
  SUBMITTED: 'Presentada',
  FISCALIZACION: 'En fiscalización',
  CONTRALORIA: 'En contraloría',
  APPROVED: 'Aprobada',
  PAID: 'Pagada',
  CANCELLED: 'Anulada',
};

function fecha(d: Date): string {
  return new Date(d).toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Planilla de avance de obra en Excel: una hoja que ya es el documento
 * completo (membrete con logo, datos del proyecto, sábana de rubros y la
 * liquidación con IVA y descuentos), más una hoja con el detalle contractual.
 */
export async function exportPlanillaExcel(planillaId: string, res: Response): Promise<void> {
  const planilla = await prisma.planilla.findFirst({
    where: { id: planillaId, deletedAt: null },
    include: {
      project: { include: { client: { select: { name: true, ruc: true } } } },
      items: {
        include: { rubro: true },
        orderBy: { rubro: { orderIndex: 'asc' } },
      },
    },
  });
  if (!planilla) throw new NotFoundError(ERRORS.PLANILLA_NOT_FOUND);

  const p = planilla.project;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CREACOM S.A.';
  wb.created = new Date();

  const sheet = wb.addWorksheet(`Planilla ${planilla.number}`, {
    properties: { defaultRowHeight: 16 },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: 12 }],
  });

  // 11 columnas: A código · B rubro · C unidad · D-E contratado · F cant ejec
  // · G-I planillas · J acumulado · K avance
  sheet.columns = [
    { key: 'code', width: 9 },
    { key: 'name', width: 44 },
    { key: 'unit', width: 9 },
    { key: 'qtyContract', width: 13 },
    { key: 'unitPrice', width: 13 },
    { key: 'contracted', width: 14 },
    { key: 'qty', width: 13 },
    { key: 'previous', width: 14 },
    { key: 'current', width: 14 },
    { key: 'accumulated', width: 14 },
    { key: 'progress', width: 10 },
  ];

  // ---------- Membrete ----------
  if (fs.existsSync(LOGO_PATH)) {
    try {
      const logoId = wb.addImage({ filename: LOGO_PATH, extension: 'png' });
      // 400×250 del original → 168×105 para que entre en las primeras filas.
      sheet.addImage(logoId, { tl: { col: 0.2, row: 0.2 }, ext: { width: 168, height: 105 } });
    } catch {
      // si el logo falla, el membrete de texto igual sale
    }
  }
  sheet.getRow(1).height = 26;
  sheet.getRow(2).height = 18;

  sheet.mergeCells('C1:G1');
  sheet.getCell('C1').value = 'CREACOM S.A.';
  sheet.getCell('C1').font = { bold: true, size: 20, color: { argb: RED } };
  sheet.getCell('C1').alignment = { vertical: 'middle' };

  sheet.mergeCells('C2:G2');
  sheet.getCell('C2').value = 'CREA INNOVACIÓN PROYECTOS Y SERVICIOS · RUC 0993273708001';
  sheet.getCell('C2').font = { size: 9, color: { argb: GRAY } };

  sheet.mergeCells('C3:G3');
  sheet.getCell('C3').value = 'AV. GUAYAQUIL, ED. MARCIMEX';
  sheet.getCell('C3').font = { size: 9, color: { argb: GRAY } };

  sheet.mergeCells('H1:K1');
  sheet.getCell('H1').value = 'PLANILLA DE AVANCE DE OBRA';
  sheet.getCell('H1').font = { bold: true, size: 14, color: { argb: RED } };
  sheet.getCell('H1').alignment = { horizontal: 'right', vertical: 'middle' };

  sheet.mergeCells('H2:K2');
  sheet.getCell('H2').value = `N° ${planilla.number}`;
  sheet.getCell('H2').font = { bold: true, size: 12 };
  sheet.getCell('H2').alignment = { horizontal: 'right' };

  sheet.mergeCells('H3:K3');
  sheet.getCell('H3').value = ESTADO[planilla.status] ?? planilla.status;
  sheet.getCell('H3').alignment = { horizontal: 'right' };
  sheet.getCell('H3').font = { color: { argb: GRAY } };

  // ---------- Datos del proyecto ----------
  const dato = (fila: number, col: 'A' | 'F', etiqueta: string, valor: string) => {
    const colValor = col === 'A' ? 'B' : 'G';
    sheet.getCell(`${col}${fila}`).value = etiqueta;
    sheet.getCell(`${col}${fila}`).font = { bold: true, size: 9, color: { argb: GRAY } };
    sheet.mergeCells(`${colValor}${fila}:${col === 'A' ? 'E' : 'K'}${fila}`);
    sheet.getCell(`${colValor}${fila}`).value = valor;
    sheet.getCell(`${colValor}${fila}`).font = { size: 10 };
  };

  dato(5, 'A', 'PROYECTO', limpiarTexto(p.name));
  dato(6, 'A', 'CÓDIGO', p.code);
  dato(7, 'A', 'TÍTULO', limpiarTexto(planilla.title));
  dato(5, 'F', 'CONTRATANTE', limpiarTexto(p.client?.name ?? p.contractor ?? '—'));
  dato(6, 'F', 'PERÍODO', `${fecha(planilla.periodStart)} al ${fecha(planilla.periodEnd)}`);
  dato(7, 'F', 'EMITIDA', fecha(new Date()));

  // ---------- Cabecera de la tabla (fila 10, dos pisos) ----------
  const H = 10;
  sheet.getRow(H).height = 28;
  const cabeceras = [
    'CÓDIGO',
    'RUBRO',
    'UNIDAD',
    'CANT. CONTR.',
    'P. UNITARIO',
    'CONTRATADO',
    'CANT. EJEC.',
    'PL. ANTERIOR',
    'PL. ACTUAL',
    'ACUMULADO',
    '% AVANCE',
  ];
  sheet.getRow(H).values = cabeceras;
  sheet.getRow(H).eachCell((cell, col) => {
    if (col > cabeceras.length) return;
    cell.font = { bold: true, size: 9, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  // ---------- Rubros ----------
  let fila = H + 1;
  for (const item of planilla.items) {
    const contratado = Number(item.rubro.budgetedAmount);
    const acumulado = Number(item.accumulatedAmount);
    sheet.getRow(fila).values = [
      item.rubro.code,
      limpiarTexto(item.rubro.name),
      limpiarTexto(item.rubro.unit ?? ''),
      Number(item.rubro.quantity),
      Number(item.rubro.unitPrice),
      contratado,
      Number(item.executedQuantity),
      Number(item.previousAmount),
      Number(item.currentAmount),
      acumulado,
      contratado > 0 ? acumulado / contratado : 0,
    ];
    sheet.getRow(fila).eachCell((cell, col) => {
      cell.border = { bottom: { style: 'thin', color: { argb: LINE } } };
      cell.alignment = col === 2 ? { wrapText: true, vertical: 'top' } : { vertical: 'top' };
    });
    fila += 1;
  }

  // ---------- Total de la sábana ----------
  const primera = H + 1;
  const ultima = fila - 1;
  const totalFila = sheet.getRow(fila);
  totalFila.getCell(2).value = 'TOTAL';
  totalFila.getCell(6).value = { formula: `SUM(F${primera}:F${ultima})` };
  totalFila.getCell(8).value = { formula: `SUM(H${primera}:H${ultima})` };
  totalFila.getCell(9).value = { formula: `SUM(I${primera}:I${ultima})` };
  totalFila.getCell(10).value = { formula: `SUM(J${primera}:J${ultima})` };
  totalFila.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } };
    cell.border = { top: { style: 'thin', color: { argb: RED } } };
  });
  const filaTotal = fila;
  fila += 2;

  // Formatos de la sábana
  for (const col of ['E', 'F', 'H', 'I', 'J']) sheet.getColumn(col).numFmt = MONEY;
  for (const col of ['D', 'G']) sheet.getColumn(col).numFmt = QTY;
  sheet.getColumn('K').numFmt = PCT;

  // ---------- Liquidación, en la MISMA hoja ----------
  sheet.mergeCells(`H${fila}:I${fila}`);
  sheet.getCell(`H${fila}`).value = 'LIQUIDACIÓN DE ESTA PLANILLA';
  sheet.getCell(`H${fila}`).font = { bold: true, size: 10, color: { argb: WHITE } };
  sheet.getCell(`H${fila}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
  sheet.getCell(`H${fila}`).alignment = { horizontal: 'center' };
  sheet.mergeCells(`J${fila}:K${fila}`);
  sheet.getCell(`J${fila}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
  fila += 1;

  const linea = (etiqueta: string, valor: number | { formula: string }, opciones?: { negativo?: boolean; fuerte?: boolean }) => {
    sheet.mergeCells(`H${fila}:I${fila}`);
    const celdaEtiqueta = sheet.getCell(`H${fila}`);
    celdaEtiqueta.value = etiqueta;
    celdaEtiqueta.font = { bold: opciones?.fuerte, size: 10 };
    sheet.mergeCells(`J${fila}:K${fila}`);
    const celdaValor = sheet.getCell(`J${fila}`);
    celdaValor.value = valor;
    celdaValor.numFmt = MONEY;
    celdaValor.font = {
      bold: opciones?.fuerte,
      size: opciones?.fuerte ? 12 : 10,
      color: { argb: opciones?.negativo ? RED : 'FF1A1A1A' },
    };
    celdaValor.alignment = { horizontal: 'right' };
    for (const c of [celdaEtiqueta, celdaValor]) {
      c.border = { bottom: { style: 'thin', color: { argb: LINE } } };
      if (opciones?.fuerte) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } };
      }
    }
    fila += 1;
  };

  const iva = Number(planilla.ivaAmount ?? 0);
  const filaBase = fila;
  linea('Valor de la planilla (base)', { formula: `I${filaTotal}` });
  linea(`IVA (${Number(p.vatPercent)}%)`, iva);
  const filaIva = filaBase + 1;
  linea('Subtotal con IVA', { formula: `J${filaBase}+J${filaIva}` }, { fuerte: true });

  if (p.isWithholdingAgent) {
    linea(`Retención IVA (${Number(p.vatRetentionPercent)}%)`, -Number(planilla.ivaRetention ?? 0), { negativo: true });
    linea(`Retención renta (${Number(p.incomeRetentionPercent)}%)`, -Number(planilla.incomeRetention ?? 0), { negativo: true });
  }
  linea(`Amortización anticipo (${Number(p.advancePercent)}%)`, -Number(planilla.advanceAmortization), { negativo: true });
  if (Number(planilla.advancePlanillaAmort ?? 0) > 0) {
    linea('Anticipo de planilla', -Number(planilla.advancePlanillaAmort), { negativo: true });
  }
  linea(`Fondo de garantía (${Number(p.guaranteePercent)}%)`, -Number(planilla.guaranteeRetention), { negativo: true });
  if (Number(planilla.otherDiscount ?? 0) > 0) {
    linea('Otros descuentos', -Number(planilla.otherDiscount), { negativo: true });
  }
  linea('TOTAL A PAGAR', Number(planilla.netPayable), { fuerte: true });

  // ---------- Firmas ----------
  const firmas = fila + 3;
  const firma = (col: string, texto: string) => {
    sheet.getCell(`${col}${firmas}`).value = '______________________________';
    sheet.getCell(`${col}${firmas + 1}`).value = texto;
    sheet.getCell(`${col}${firmas + 1}`).font = { size: 9, color: { argb: GRAY } };
  };
  firma('B', 'Elaborado por — CREACOM S.A.');
  firma('F', 'Fiscalizador');
  firma('I', 'Contratante');

  // ---------- Hoja 2: datos del contrato ----------
  const liq = wb.addWorksheet('Contrato');
  liq.columns = [
    { key: 'concept', width: 40 },
    { key: 'value', width: 22 },
  ];
  liq.getRow(1).values = ['CONCEPTO', 'VALOR'];
  liq.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
  });

  const contrato = Number(p.contractAmount);
  const anticipo = contrato * (Number(p.advancePercent) / 100);
  const agregar = (concepto: string, valor: string | number, money = false) => {
    const r = liq.addRow({ concept: concepto, value: valor });
    if (money) r.getCell(2).numFmt = MONEY;
  };

  agregar('Proyecto', limpiarTexto(p.name));
  agregar('Código', p.code);
  agregar('Contratante', limpiarTexto(p.client?.name ?? p.contractor ?? '—'));
  agregar('Período de la planilla', `${fecha(planilla.periodStart)} al ${fecha(planilla.periodEnd)}`);
  liq.addRow({});
  agregar('Monto contractual', contrato, true);
  agregar(`Anticipo (${Number(p.advancePercent)}%)`, anticipo, true);
  agregar(`IVA del proyecto`, `${Number(p.vatPercent)}%`);
  agregar(`Fondo de garantía`, `${Number(p.guaranteePercent)}%`);
  agregar('¿Agente de retención?', p.isWithholdingAgent ? 'Sí' : 'No');
  liq.addRow({});
  agregar('Planillado acumulado', Number(planilla.totalAccumulated), true);
  agregar('Saldo por planillar', contrato - Number(planilla.totalAccumulated), true);

  // ---------- Envío ----------
  const filename = `Planilla ${planilla.number} - ${limpiarTexto(p.name) || p.code}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}
