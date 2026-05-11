import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';

const RED = 'FFC73E2C';
const WHITE = 'FFFFFFFF';

export async function exportProformaExcel(id: string, res: Response): Promise<void> {
  const p = await prisma.proforma.findFirst({
    where: { id, deletedAt: null },
    include: {
      project: { select: { name: true, code: true } },
      items: { orderBy: { orderIndex: 'asc' } },
      images: { orderBy: { orderIndex: 'asc' } },
    },
  });
  if (!p) throw new NotFoundError('Proforma no encontrada');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CREACOM S.A.';
  wb.created = new Date();

  const sheet = wb.addWorksheet(`Proforma ${p.number}`, {
    properties: { defaultRowHeight: 18 },
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
  });

  // Header — title
  sheet.mergeCells('A1:E1');
  sheet.getCell('A1').value = 'CREACOM S.A.';
  sheet.getCell('A1').font = { bold: true, size: 22, color: { argb: RED } };

  sheet.mergeCells('A2:E2');
  sheet.getCell('A2').value = 'Innovación · Proyectos · Servicios';
  sheet.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } };

  sheet.mergeCells('F1:G1');
  sheet.getCell('F1').value = 'PROFORMA';
  sheet.getCell('F1').font = { bold: true, size: 24, color: { argb: RED } };
  sheet.getCell('F1').alignment = { horizontal: 'right' };

  sheet.mergeCells('F2:G2');
  sheet.getCell('F2').value = `No. ${p.number}`;
  sheet.getCell('F2').font = { bold: true };
  sheet.getCell('F2').alignment = { horizontal: 'right' };

  sheet.mergeCells('F3:G3');
  sheet.getCell('F3').value = p.date.toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  sheet.getCell('F3').alignment = { horizontal: 'right' };

  // Emisor + Cliente
  sheet.getCell('A5').value = 'CREA INNOVACION PROYECTOS Y SERVICIOS\nCREACOM S.A.';
  sheet.getCell('A5').alignment = { wrapText: true, vertical: 'top' };
  sheet.getCell('A5').font = { bold: true };
  sheet.getCell('A6').value = 'RUC: 0993273708001';
  sheet.getCell('A7').value = 'AUT SRI: 31234567817';
  sheet.getCell('A8').value = 'DIRECCION: AV. GUAYAQUIL, ED. MARCIMEX';

  sheet.getCell('D5').value = p.clientName;
  sheet.getCell('D5').font = { bold: true };
  sheet.getCell('D5').alignment = { horizontal: 'right' };
  if (p.clientRuc) {
    sheet.getCell('D6').value = `RUC: ${p.clientRuc}`;
    sheet.getCell('D6').alignment = { horizontal: 'right' };
  }
  if (p.clientAddress) {
    sheet.getCell('D7').value = `DIRECCION: ${p.clientAddress}`;
    sheet.getCell('D7').alignment = { horizontal: 'right' };
  }
  if (p.projectLabel || p.project) {
    sheet.getCell('D8').value = `PROYECTO: ${p.projectLabel || p.project?.name}`;
    sheet.getCell('D8').alignment = { horizontal: 'right' };
  }
  if (p.clientResponsible) {
    sheet.getCell('D9').value = `RESPONSABLE: ${p.clientResponsible}`;
    sheet.getCell('D9').alignment = { horizontal: 'right' };
  }

  // Header de tabla
  const HEADER_ROW = 11;
  const headers = ['CANT', 'UNI', 'DETALLE', '', '', 'V. UNITARIO', 'V. TOTAL'];
  sheet.getRow(HEADER_ROW).values = headers;
  sheet.mergeCells(HEADER_ROW, 3, HEADER_ROW, 5);
  sheet.getRow(HEADER_ROW).eachCell((cell, col) => {
    if (col > headers.length) return;
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: RED } },
      bottom: { style: 'thin', color: { argb: RED } },
    };
  });

  sheet.columns = [
    { key: 'cant', width: 8 },
    { key: 'uni', width: 8 },
    { key: 'detail1', width: 12 },
    { key: 'detail2', width: 18 },
    { key: 'detail3', width: 12 },
    { key: 'unitPrice', width: 14 },
    { key: 'total', width: 14 },
  ];

  let row = HEADER_ROW + 1;
  let subtotal = 0;
  for (const it of p.items) {
    const total = it.quantity * it.unitPrice;
    subtotal += total;
    sheet.getCell(row, 1).value = it.quantity;
    sheet.getCell(row, 2).value = it.unit;
    sheet.mergeCells(row, 3, row, 5);
    sheet.getCell(row, 3).value = it.description;
    sheet.getCell(row, 3).alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    sheet.getCell(row, 6).value = it.unitPrice;
    sheet.getCell(row, 6).numFmt = '"$"#,##0.00';
    sheet.getCell(row, 7).value = total;
    sheet.getCell(row, 7).numFmt = '"$"#,##0.00';
    sheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell(row, 2).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell(row, 6).alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getCell(row, 7).alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getRow(row).eachCell((c) => {
      c.border = { bottom: { style: 'thin', color: { argb: 'FFE5E1DC' } } };
    });
    row += 1;
  }

  const iva = subtotal * (p.ivaPercent / 100);
  const total = subtotal + iva;

  row += 1;
  // Notes box (left)
  const NOTES_TOP = row;
  if (p.creditTerm) {
    sheet.getCell(row, 1).value = `• Plazo de credito: ${p.creditTerm}`;
    sheet.mergeCells(row, 1, row, 4);
    row += 1;
  }
  if (p.paymentTerms) {
    sheet.getCell(row, 1).value = `• Forma de pago: ${p.paymentTerms}`;
    sheet.mergeCells(row, 1, row, 4);
    row += 1;
  }
  if (p.validity) {
    sheet.getCell(row, 1).value = `• Vigencia de la oferta: ${p.validity}`;
    sheet.mergeCells(row, 1, row, 4);
    row += 1;
  }
  if (p.topClients) {
    row += 1;
    sheet.getCell(row, 1).value = 'PRINCIPALES CLIENTES:';
    sheet.getCell(row, 1).font = { bold: true };
    sheet.mergeCells(row, 1, row, 4);
    row += 1;
    for (const c of p.topClients.split('\n').filter(Boolean)) {
      sheet.getCell(row, 1).value = `• ${c}`;
      sheet.mergeCells(row, 1, row, 4);
      row += 1;
    }
  }

  // Totals box (right) — anchor to NOTES_TOP
  sheet.getCell(NOTES_TOP, 6).value = 'SUBTOTAL:';
  sheet.getCell(NOTES_TOP, 6).font = { bold: true };
  sheet.getCell(NOTES_TOP, 7).value = subtotal;
  sheet.getCell(NOTES_TOP, 7).numFmt = '"$"#,##0.00';
  sheet.getCell(NOTES_TOP, 7).font = { bold: true };

  sheet.getCell(NOTES_TOP + 1, 6).value = `IVA ${p.ivaPercent}%`;
  sheet.getCell(NOTES_TOP + 1, 6).font = { bold: true };
  sheet.getCell(NOTES_TOP + 1, 7).value = iva;
  sheet.getCell(NOTES_TOP + 1, 7).numFmt = '"$"#,##0.00';

  sheet.getCell(NOTES_TOP + 2, 6).value = 'TOTAL:';
  sheet.getCell(NOTES_TOP + 2, 6).font = { bold: true, color: { argb: RED } };
  sheet.getCell(NOTES_TOP + 2, 7).value = total;
  sheet.getCell(NOTES_TOP + 2, 7).numFmt = '"$"#,##0.00';
  sheet.getCell(NOTES_TOP + 2, 7).font = { bold: true, color: { argb: RED } };

  // Signature
  row += 2;
  sheet.getCell(row, 6).value = p.signerName || 'Gabriel Constantine L.';
  sheet.getCell(row, 6).alignment = { horizontal: 'center' };
  sheet.mergeCells(row, 6, row, 7);
  sheet.getCell(row + 1, 6).value = p.signerTitle || 'Gerente General';
  sheet.getCell(row + 1, 6).alignment = { horizontal: 'center' };
  sheet.mergeCells(row + 1, 6, row + 1, 7);

  // Imágenes adjuntas — hoja separada
  if (p.images && p.images.length > 0) {
    const imgSheet = wb.addWorksheet('Imágenes');
    imgSheet.getCell('A1').value = `Imágenes adjuntas — Proforma ${p.number}`;
    imgSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: RED } };
    imgSheet.mergeCells('A1:F1');

    let imgRow = 3;
    for (const img of p.images) {
      const ext = (img.mimeType.split('/')[1] || 'png').toLowerCase();
      const extension = ext === 'jpg' ? 'jpeg' : (ext as 'png' | 'jpeg' | 'gif');
      try {
        const imgId = wb.addImage({
          buffer: Buffer.from(img.data) as unknown as ArrayBuffer,
          extension,
        });
        imgSheet.addImage(imgId, {
          tl: { col: 0, row: imgRow - 1 },
          ext: { width: 360, height: 240 },
        });
      } catch {
        imgSheet.getCell(imgRow, 1).value = '(No se pudo cargar la imagen)';
      }
      if (img.caption) {
        imgSheet.getCell(imgRow + 13, 1).value = img.caption;
        imgSheet.getCell(imgRow + 13, 1).font = { italic: true };
        imgSheet.mergeCells(imgRow + 13, 1, imgRow + 13, 6);
      }
      imgRow += 16;
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="proforma-${p.number}.xlsx"`,
  );
  res.send(Buffer.from(buffer));
}
