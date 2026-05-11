import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { ProjectsService } from './projects.service';

const RED = 'FFC73E2C';
const RED_LIGHT = 'FFFCEDEA';
const DARK = 'FF1A1A1A';
const WHITE = 'FFFFFFFF';
const SOFT = 'FFFAF7F2';
const BORDER = 'FFE5E1DC';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  PAUSED: 'Pausado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

export async function exportProjectsReport(res: Response): Promise<void> {
  const stats = await ProjectsService.getGlobalStats();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CREACOM S.A.';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Informe consolidado', {
    properties: { defaultRowHeight: 22 },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  // ---------- Título ----------
  sheet.mergeCells('A1:H1');
  sheet.getCell('A1').value = 'CREACOM — Informe consolidado de proyectos';
  sheet.getCell('A1').font = { bold: true, size: 18, color: { argb: RED } };
  sheet.getCell('A1').alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 32;

  sheet.mergeCells('A2:H2');
  sheet.getCell('A2').value = `Generado: ${new Date().toLocaleString('es-EC')} · ${stats.projects.length} proyecto(s)`;
  sheet.getCell('A2').font = { italic: true, color: { argb: 'FF666666' }, size: 10 };

  // ---------- Cabecera ----------
  const HEADER_ROW = 4;
  const headers = [
    'N° contrato',
    'Proyecto',
    'Contratante',
    'Ciudad',
    'Estado',
    'Monto contractual',
    'Invertido / gastado',
    'Monto planillado',
    'Por cobrar',
    'Por pagar a proveedores',
  ];
  sheet.getRow(HEADER_ROW).values = headers;
  sheet.getRow(HEADER_ROW).eachCell((cell, col) => {
    if (col > headers.length) return;
    cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: RED } },
      bottom: { style: 'thin', color: { argb: RED } },
    };
  });
  sheet.getRow(HEADER_ROW).height = 28;

  sheet.columns = [
    { key: 'code', width: 22 },
    { key: 'name', width: 38 },
    { key: 'contractor', width: 24 },
    { key: 'city', width: 16 },
    { key: 'status', width: 14 },
    { key: 'contractAmount', width: 18 },
    { key: 'spent', width: 18 },
    { key: 'planillado', width: 18 },
    { key: 'porCobrar', width: 18 },
    { key: 'pending', width: 22 },
  ];

  // ---------- Filas ----------
  let r = HEADER_ROW + 1;
  for (let i = 0; i < stats.projects.length; i += 1) {
    const p = stats.projects[i];
    const row = sheet.getRow(r);
    row.values = [
      p.code,
      p.name,
      p.contractor ?? '—',
      p.city ?? '—',
      STATUS_LABEL[p.status] ?? p.status,
      p.contractAmount,
      p.spent,
      p.planillado,
      p.porCobrar,
      p.pending,
    ];
    // Estilo zebra
    row.eachCell((cell, col) => {
      if (col > headers.length) return;
      cell.alignment = {
        vertical: 'middle',
        horizontal: col >= 6 ? 'right' : 'left',
        wrapText: false,
      };
      cell.font = { size: 10, color: { argb: DARK } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: BORDER } },
      };
      if (i % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } };
      }
      // Formato moneda en columnas numéricas
      if (col >= 6) {
        cell.numFmt = '"$"#,##0.00';
      }
      // Estado con color
      if (col === 5) {
        cell.font = {
          size: 10,
          bold: true,
          color: {
            argb:
              p.status === 'ACTIVE'
                ? 'FF1B7A52'
                : p.status === 'COMPLETED'
                  ? 'FF1B7A52'
                  : p.status === 'PAUSED'
                    ? 'FFC77800'
                    : p.status === 'CANCELLED'
                      ? 'FF7E1F1F'
                      : DARK,
          },
        };
      }
      // Por pagar con tinte rojo cuando hay deuda
      if (col === 10 && Number(p.pending) > 0) {
        cell.font = { size: 10, bold: true, color: { argb: 'FF7E1F1F' } };
      }
    });
    row.height = 22;
    r += 1;
  }

  // ---------- Totales ----------
  const totalRow = sheet.getRow(r + 1);
  totalRow.values = [
    'TOTALES',
    '',
    '',
    '',
    '',
    stats.totals.contractAmount,
    stats.totals.spent,
    stats.totals.planillado,
    stats.totals.porCobrar,
    stats.totals.pendingOrders,
  ];
  totalRow.eachCell((cell, col) => {
    if (col > headers.length) return;
    cell.font = { bold: true, size: 11, color: { argb: RED } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_LIGHT } };
    cell.alignment = { vertical: 'middle', horizontal: col >= 6 ? 'right' : 'left' };
    cell.border = {
      top: { style: 'medium', color: { argb: RED } },
      bottom: { style: 'medium', color: { argb: RED } },
    };
    if (col >= 6) cell.numFmt = '"$"#,##0.00';
  });
  totalRow.height = 28;

  // ---------- Sub-resumen ----------
  const summaryY = r + 4;
  sheet.getCell(`A${summaryY}`).value = 'Resumen ejecutivo';
  sheet.getCell(`A${summaryY}`).font = { bold: true, size: 12, color: { argb: RED } };
  sheet.mergeCells(`A${summaryY}:E${summaryY}`);

  const summaryRows: Array<[string, number, string?]> = [
    ['Proyectos activos', stats.totals.activeCount, '0'],
    ['Total contratado', stats.totals.contractAmount],
    ['Total ejecutado', stats.totals.spent],
    ['Total planillado', stats.totals.planillado],
    ['Por cobrar al cliente', stats.totals.porCobrar],
    ['Por pagar a proveedores', stats.totals.pendingOrders],
  ];
  for (let i = 0; i < summaryRows.length; i += 1) {
    const [label, value, fmt] = summaryRows[i];
    const y = summaryY + 1 + i;
    sheet.getCell(`A${y}`).value = label;
    sheet.getCell(`A${y}`).font = { size: 10, color: { argb: DARK } };
    sheet.mergeCells(`A${y}:C${y}`);
    sheet.getCell(`D${y}`).value = value;
    sheet.getCell(`D${y}`).numFmt = fmt ?? '"$"#,##0.00';
    sheet.getCell(`D${y}`).font = { bold: true, size: 10, color: { argb: RED } };
    sheet.getCell(`D${y}`).alignment = { horizontal: 'right' };
  }

  // ---------- Envío ----------
  const buffer = await wb.xlsx.writeBuffer();
  const filename = `creacom-informe-proyectos-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}
