import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { ERRORS } from '../../shared/constants/error-messages';

const HEADER_FILL = 'FF534AB7';
const HEADER_TEXT = 'FFFFFFFF';

export async function exportGastosExcel(
  projectId: string,
  rubroId: string | undefined,
  res: Response,
): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
  });
  if (!project) throw new NotFoundError(ERRORS.PROJECT_NOT_FOUND);

  const gastos = await prisma.gasto.findMany({
    where: {
      projectId,
      deletedAt: null,
      ...(rubroId ? { rubroId } : {}),
    },
    include: { rubro: { select: { code: true, name: true, unit: true } } },
    orderBy: { gastoDate: 'desc' },
  });

  const rubroLabel = rubroId
    ? gastos[0]?.rubro
      ? `${gastos[0].rubro.code}. ${gastos[0].rubro.name}`
      : 'Filtrado por rubro'
    : 'Todos los rubros';

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IvisAllConst';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Gastos', { properties: { defaultRowHeight: 18 } });

  // Cabecera del proyecto
  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = `Gastos — ${project.name}`;
  sheet.getCell('A1').font = { bold: true, size: 14 };

  sheet.mergeCells('A2:F2');
  sheet.getCell('A2').value = `Filtro: ${rubroLabel} · Generado: ${new Date().toLocaleString('es-EC')}`;
  sheet.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } };

  sheet.getRow(3).values = [
    'Fecha',
    'Rubro',
    'Descripción',
    'Nº factura',
    'Monto',
    'Registrado',
  ];
  sheet.getRow(3).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  sheet.columns = [
    { key: 'date', width: 12 },
    { key: 'rubro', width: 36 },
    { key: 'description', width: 50 },
    { key: 'invoice', width: 18 },
    { key: 'amount', width: 14 },
    { key: 'createdAt', width: 18 },
  ];

  // Datos
  let total = 0;
  for (const g of gastos) {
    const amount = Number(g.amount);
    total += amount;
    sheet.addRow({
      date: g.gastoDate.toISOString().slice(0, 10),
      rubro: g.rubro ? `${g.rubro.code}. ${g.rubro.name}` : '—',
      description: g.description,
      invoice: g.invoiceNumber ?? '',
      amount,
      createdAt: g.createdAt.toISOString().slice(0, 10),
    });
  }

  // Formato moneda en columna E
  const amountCol = sheet.getColumn(5);
  amountCol.numFmt = '"$"#,##0.00';
  amountCol.alignment = { horizontal: 'right' };

  // Fila total
  const totalRow = sheet.addRow({
    date: '',
    rubro: '',
    description: 'TOTAL',
    invoice: '',
    amount: total,
    createdAt: '',
  });
  totalRow.font = { bold: true };
  totalRow.getCell(5).numFmt = '"$"#,##0.00';

  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  const filename = `gastos-${project.code}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}
