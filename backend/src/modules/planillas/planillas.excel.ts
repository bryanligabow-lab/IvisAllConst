import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { ERRORS } from '../../shared/constants/error-messages';

const COL_WIDTHS = {
  CODE: 8,
  NAME: 36,
  UNIT: 10,
  NUMERIC: 14,
} as const;

const HEADER_FILL = 'FF534AB7';
const HEADER_TEXT = 'FFFFFFFF';
const HIGHLIGHT_FILL = 'FFF0EFFB';

export async function exportPlanillaExcel(planillaId: string, res: Response): Promise<void> {
  const planilla = await prisma.planilla.findFirst({
    where: { id: planillaId, deletedAt: null },
    include: {
      project: true,
      items: {
        include: { rubro: true },
        orderBy: { rubro: { orderIndex: 'asc' } },
      },
    },
  });
  if (!planilla) throw new NotFoundError(ERRORS.PLANILLA_NOT_FOUND);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IvisAllConst';
  wb.created = new Date();

  // ---------- Hoja 1: Sábana de rubros ----------
  const sheet = wb.addWorksheet('Sábana de rubros', {
    properties: { defaultRowHeight: 18 },
  });

  sheet.columns = [
    { header: 'Código', key: 'code', width: COL_WIDTHS.CODE },
    { header: 'Rubro', key: 'name', width: COL_WIDTHS.NAME },
    { header: 'Unidad', key: 'unit', width: COL_WIDTHS.UNIT },
    { header: 'Contratado', key: 'contracted', width: COL_WIDTHS.NUMERIC },
    { header: 'Cant. ejec.', key: 'qty', width: COL_WIDTHS.NUMERIC },
    { header: 'Pl. actual', key: 'current', width: COL_WIDTHS.NUMERIC },
    { header: 'Pl. anterior', key: 'previous', width: COL_WIDTHS.NUMERIC },
    { header: 'Acumulado', key: 'accumulated', width: COL_WIDTHS.NUMERIC },
  ];

  // Encabezado coloreado
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Filas de datos
  for (const item of planilla.items) {
    sheet.addRow({
      code: item.rubro.code,
      name: item.rubro.name,
      unit: item.rubro.unit ?? '',
      contracted: Number(item.rubro.budgetedAmount),
      qty: Number(item.executedQuantity),
      current: Number(item.currentAmount),
      previous: Number(item.previousAmount),
      accumulated: Number(item.accumulatedAmount),
    });
  }

  // Formato numérico
  ['D', 'F', 'G', 'H'].forEach((col) => {
    sheet.getColumn(col).numFmt = '"$"#,##0.00';
  });
  sheet.getColumn('E').numFmt = '#,##0.0000';

  // Total
  const totalRow = sheet.addRow({
    code: '',
    name: 'TOTAL',
    unit: '',
    contracted: Number(planilla.project.contractAmount),
    qty: '',
    current: Number(planilla.totalCurrent),
    previous: Number(planilla.totalPrevious),
    accumulated: Number(planilla.totalAccumulated),
  });
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HIGHLIGHT_FILL } };
  });

  // ---------- Hoja 2: Liquidación ----------
  const liq = wb.addWorksheet('Liquidación');
  liq.columns = [
    { header: 'Concepto', key: 'concept', width: 38 },
    { header: 'Valor', key: 'value', width: 18 },
  ];
  liq.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  });

  const contract = Number(planilla.project.contractAmount);
  const advance = contract * (Number(planilla.project.advancePercent) / 100);

  liq.addRow({ concept: 'Proyecto', value: planilla.project.name });
  liq.addRow({ concept: 'Código', value: planilla.project.code });
  liq.addRow({
    concept: 'Período',
    value: `${planilla.periodStart.toISOString().slice(0, 10)} a ${planilla.periodEnd.toISOString().slice(0, 10)}`,
  });
  liq.addRow({});
  liq.addRow({ concept: 'Monto contractual', value: contract });
  liq.addRow({ concept: `Anticipo (${planilla.project.advancePercent}%)`, value: advance });
  liq.addRow({});
  liq.addRow({ concept: 'Valor de planilla (base)', value: Number(planilla.totalCurrent) });
  liq.addRow({ concept: `IVA (${planilla.project.vatPercent}%)`, value: Number(planilla.ivaAmount ?? 0) });
  liq.addRow({
    concept: 'Subtotal con IVA',
    value: Number(planilla.totalCurrent) + Number(planilla.ivaAmount ?? 0),
  });
  if (planilla.project.isWithholdingAgent) {
    liq.addRow({ concept: `Retención IVA (${planilla.project.vatRetentionPercent}%)`, value: -Number(planilla.ivaRetention ?? 0) });
    liq.addRow({ concept: `Retención renta (${planilla.project.incomeRetentionPercent}%)`, value: -Number(planilla.incomeRetention ?? 0) });
  }
  liq.addRow({ concept: 'Amortización anticipo', value: -Number(planilla.advanceAmortization) });
  liq.addRow({ concept: `Fondo garantía (${planilla.project.guaranteePercent}%)`, value: -Number(planilla.guaranteeRetention) });
  const totalRowLiq = liq.addRow({ concept: 'TOTAL A PAGAR (neto)', value: Number(planilla.netPayable) });
  totalRowLiq.font = { bold: true };
  totalRowLiq.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HIGHLIGHT_FILL } };
  });

  liq.getColumn('B').numFmt = '"$"#,##0.00';

  // ---------- Envío ----------
  const filename = `planilla-${planilla.project.code}-N${planilla.number}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}
