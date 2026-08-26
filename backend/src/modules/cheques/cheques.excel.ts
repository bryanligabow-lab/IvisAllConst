import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { prisma } from '../../config/database';

const RED = 'FFC73E2C';
const WHITE = 'FFFFFFFF';

const ESTADO_LABEL: Record<string, string> = {
  COBRADO: 'Cobrado',
  PENDIENTE: 'Pendiente',
  VENCIDO: 'Vencido',
  ANULADO: 'Anulado',
};

function soloFecha(d: Date | null): string {
  if (!d) return '';
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}/${x.getUTCFullYear()}`;
}

/**
 * Libro de cheques: una hoja por chequera con todos sus cheques (número,
 * emisión, cobro, beneficiario, monto, estado, financiamiento y observaciones),
 * más una hoja "TODOS" para buscar en conjunto.
 */
export async function exportChequesExcel(res: Response): Promise<void> {
  const [chequeras, cheques] = await Promise.all([
    prisma.chequera.findMany({ where: { deletedAt: null }, orderBy: { orderIndex: 'asc' } }),
    prisma.cheque.findMany({
      where: { deletedAt: null },
      include: { group: { select: { name: true } } },
    }),
  ]);

  // Más reciente primero dentro de cada hoja.
  const fechaOrden = (c: (typeof cheques)[number]) =>
    (c.dueDate ?? c.issueDate ?? c.cashDate)?.getTime() ?? 0;
  const ordenados = [...cheques].sort((a, b) => fechaOrden(b) - fechaOrden(a));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CREACOM S.A.';
  wb.created = new Date();

  const columnas = [
    { header: 'Nº CHEQUE', key: 'num', width: 12 },
    { header: 'F. EMISIÓN', key: 'emision', width: 13 },
    { header: 'F. COBRO', key: 'cobro', width: 13 },
    { header: 'F. COBRADO', key: 'cobrado', width: 13 },
    { header: 'BENEFICIARIO / DETALLE', key: 'benef', width: 38 },
    { header: 'MONTO', key: 'monto', width: 14 },
    { header: 'ESTADO', key: 'estado', width: 12 },
    { header: 'FINANCIAMIENTO', key: 'grupo', width: 22 },
    { header: 'CUOTA', key: 'cuota', width: 8 },
    { header: 'OBSERVACIONES', key: 'obs', width: 34 },
  ];

  const armarHoja = (titulo: string, lista: typeof ordenados, subtitulo: string) => {
    // Excel no admite : \ / ? * [ ] en el nombre de hoja, ni más de 31 chars.
    const nombre = titulo.replace(/[:\\/?*[\]]/g, '-').slice(0, 31);
    const sheet = wb.addWorksheet(nombre, {
      views: [{ state: 'frozen', ySplit: 3 }],
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    });

    sheet.mergeCells(1, 1, 1, columnas.length);
    sheet.getCell('A1').value = titulo;
    sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: RED } };

    sheet.mergeCells(2, 1, 2, columnas.length);
    sheet.getCell('A2').value = subtitulo;
    sheet.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF666666' } };

    sheet.getRow(3).values = columnas.map((c) => c.header);
    sheet.columns = columnas.map((c) => ({ key: c.key, width: c.width }));
    sheet.getRow(3).eachCell((cell, col) => {
      if (col > columnas.length) return;
      cell.font = { bold: true, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    let fila = 4;
    for (const c of lista) {
      sheet.getCell(fila, 1).value = c.number || '';
      sheet.getCell(fila, 2).value = soloFecha(c.issueDate);
      sheet.getCell(fila, 3).value = soloFecha(c.dueDate ?? c.issueDate);
      sheet.getCell(fila, 4).value = soloFecha(c.cashDate);
      sheet.getCell(fila, 5).value = c.beneficiary ?? '';
      sheet.getCell(fila, 6).value = c.amount;
      sheet.getCell(fila, 6).numFmt = '"$"#,##0.00';
      sheet.getCell(fila, 7).value = ESTADO_LABEL[c.status] ?? c.status;
      sheet.getCell(fila, 8).value = c.group?.name ?? '';
      sheet.getCell(fila, 9).value = c.installment ?? '';
      sheet.getCell(fila, 10).value = c.notes ?? '';
      sheet.getRow(fila).eachCell((cell) => {
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E1DC' } } };
      });
      fila += 1;
    }

    // Totales al pie.
    const activos = lista.filter((c) => c.status !== 'ANULADO');
    const pend = activos.filter((c) => c.status === 'PENDIENTE');
    sheet.getCell(fila + 1, 5).value = 'TOTAL EMITIDO';
    sheet.getCell(fila + 1, 5).font = { bold: true };
    sheet.getCell(fila + 1, 6).value = activos.reduce((s, c) => s + c.amount, 0);
    sheet.getCell(fila + 1, 6).numFmt = '"$"#,##0.00';
    sheet.getCell(fila + 1, 6).font = { bold: true };
    sheet.getCell(fila + 2, 5).value = `TOTAL PENDIENTE (${pend.length})`;
    sheet.getCell(fila + 2, 5).font = { bold: true, color: { argb: RED } };
    sheet.getCell(fila + 2, 6).value = pend.reduce((s, c) => s + c.amount, 0);
    sheet.getCell(fila + 2, 6).numFmt = '"$"#,##0.00';
    sheet.getCell(fila + 2, 6).font = { bold: true, color: { argb: RED } };

    // Filtro por columna para poder buscar dentro de la hoja.
    sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, fila - 1), column: columnas.length } };
  };

  // Una hoja por chequera (solo las que tienen cheques).
  for (const q of chequeras) {
    const propios = ordenados.filter((c) => c.chequeraId === q.id);
    if (propios.length === 0) continue;
    armarHoja(q.corto, propios, `${q.empresa} · ${q.banco} — ${propios.length} cheques`);
  }

  // Los que quedaron sin chequera asignada.
  const huerfanos = ordenados.filter((c) => !c.chequeraId);
  if (huerfanos.length > 0) {
    armarHoja('Sin chequera', huerfanos, `${huerfanos.length} cheques sin chequera asignada`);
  }

  // Hoja general para buscar en todo.
  armarHoja('TODOS', ordenados, `Todos los cheques — ${ordenados.length} registros`);

  const buffer = await wb.xlsx.writeBuffer();
  const hoy = new Date().toISOString().slice(0, 10);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="Cheques CREACOM ${hoy}.xlsx"`);
  res.send(Buffer.from(buffer));
}
