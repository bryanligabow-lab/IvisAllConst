/* eslint-disable @typescript-eslint/no-require-imports */
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';

const RED = '#C73E2C';
const DARK = '#1A1A1A';
const GRAY = '#5C5C5C';
const LIGHT_GRAY = '#E5E1DC';
const SOFT_BG = '#FCEDEA';

const LOGO_PATH = path.resolve(__dirname, '../../../assets/logo-creacom.png');

function formatMoney(n: number): string {
  return n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function exportProformaPdf(id: string, res: Response): Promise<void> {
  const p = await prisma.proforma.findFirst({
    where: { id, deletedAt: null },
    include: {
      project: { select: { name: true, code: true } },
      items: { orderBy: { orderIndex: 'asc' } },
    },
  });
  if (!p) throw new NotFoundError('Proforma no encontrada');

  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: {
      Title: `Proforma ${p.number}`,
      Author: 'CREACOM S.A.',
    },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="proforma-${p.number}.pdf"`,
  );
  doc.pipe(res);

  const PAGE_W = doc.page.width;
  const PAGE_H = doc.page.height;
  const M = 40;
  const W = PAGE_W - M * 2;

  // ===== Encabezado: logo izq + PROFORMA der =====
  const headerY = M;
  if (fs.existsSync(LOGO_PATH)) {
    try {
      doc.image(LOGO_PATH, M, headerY - 8, { fit: [200, 90] });
    } catch {
      /* ignore */
    }
  } else {
    doc.fillColor(RED).font('Helvetica-Bold').fontSize(28).text('CREACOM', M, headerY);
    doc.fillColor(GRAY).font('Helvetica').fontSize(8).text('Innovación · Proyectos · Servicios', M, headerY + 32);
  }

  // PROFORMA derecha
  const rightX = M + W;
  doc
    .fillColor(RED)
    .font('Helvetica-Bold')
    .fontSize(36)
    .text('PROFORMA', rightX - 200, headerY + 4, { width: 200, align: 'right' });
  doc
    .fillColor(DARK)
    .fontSize(10)
    .text(`No. ${p.number}`, rightX - 200, headerY + 44, { width: 200, align: 'right' });

  // Línea separadora
  doc
    .moveTo(M, headerY + 92)
    .lineTo(M + W, headerY + 92)
    .lineWidth(1.5)
    .strokeColor(RED)
    .stroke();

  // Fecha
  doc
    .fillColor(DARK)
    .font('Helvetica')
    .fontSize(9)
    .text(formatDateLong(p.date), M, headerY + 100, { width: W, align: 'right' });

  // ===== Emisor (izq) + Cliente (der) =====
  const blockY = headerY + 122;
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10).text('CREA INNOVACION PROYECTOS Y SERVICIOS', M, blockY);
  doc.font('Helvetica-Bold').text('CREACOM S.A.', M, blockY + 12);
  doc.font('Helvetica').fontSize(9).fillColor(DARK);
  doc.text('RUC: 0993273708001', M, blockY + 26);
  doc.text('AUT SRI: 31234567817', M, blockY + 38);
  doc.text('DIRECCION: AV. GUAYAQUIL, ED. MARCIMEX', M, blockY + 50);

  // Cliente
  const clientX = M + W / 2 + 10;
  const clientW = W / 2 - 10;
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(p.clientName.toUpperCase(), clientX, blockY, { width: clientW, align: 'right' });
  let cy = blockY + 14;
  doc.font('Helvetica').fontSize(9);
  if (p.clientRuc) {
    doc.text(`RUC: ${p.clientRuc}`, clientX, cy, { width: clientW, align: 'right' });
    cy += 12;
  }
  if (p.clientAddress) {
    doc.text(`DIRECCION: ${p.clientAddress}`, clientX, cy, { width: clientW, align: 'right' });
    cy += 12;
  }
  if (p.projectLabel || p.project) {
    doc.text(`PROYECTO: ${p.projectLabel || p.project?.name}`, clientX, cy, {
      width: clientW,
      align: 'right',
    });
    cy += 12;
  }
  if (p.clientResponsible) {
    doc.text(`RESPONSABLE: ${p.clientResponsible}`, clientX, cy, {
      width: clientW,
      align: 'right',
    });
  }

  // ===== Tabla =====
  const tableTop = blockY + 88;
  const colX = [M, M + 50, M + 100, M + W - 200, M + W - 100, M + W];
  const colWidths = [50, 50, W - 250, 100, 100];

  // Header rojo
  doc.rect(M, tableTop, W, 28).fill(RED);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
  const headerTextY = tableTop + 10;
  doc.text('CANT', colX[0], headerTextY, { width: colWidths[0], align: 'center' });
  doc.text('UNI', colX[1], headerTextY, { width: colWidths[1], align: 'center' });
  doc.text('DETALLE', colX[2], headerTextY, { width: colWidths[2], align: 'center' });
  doc.text('V. UNITARIO', colX[3], headerTextY, { width: colWidths[3], align: 'center' });
  doc.text('V. TOTAL', colX[4], headerTextY, { width: colWidths[4], align: 'center' });

  // Filas
  let rowY = tableTop + 28;
  let subtotal = 0;
  doc.fillColor(DARK).font('Helvetica').fontSize(9);

  for (const it of p.items) {
    const totalLine = it.quantity * it.unitPrice;
    subtotal += totalLine;

    const detailH = doc.heightOfString(it.description, { width: colWidths[2] - 8 });
    const rowH = Math.max(26, detailH + 12);

    if (rowY + rowH > PAGE_H - 240) {
      doc.addPage();
      rowY = M;
    }

    // Sombra ligera alterna
    doc
      .moveTo(M, rowY + rowH)
      .lineTo(M + W, rowY + rowH)
      .lineWidth(0.5)
      .strokeColor(LIGHT_GRAY)
      .stroke();

    doc.fillColor(DARK).font('Helvetica').fontSize(9);
    const cellY = rowY + rowH / 2 - 5;
    doc.text(String(it.quantity), colX[0], cellY, { width: colWidths[0], align: 'center' });
    doc.text(it.unit, colX[1], cellY, { width: colWidths[1], align: 'center' });
    doc.text(it.description, colX[2] + 4, rowY + 6, {
      width: colWidths[2] - 8,
      align: 'center',
    });
    doc.text(`$ ${formatMoney(it.unitPrice)}`, colX[3], cellY, {
      width: colWidths[3] - 8,
      align: 'right',
    });
    doc.text(`$ ${formatMoney(totalLine)}`, colX[4], cellY, {
      width: colWidths[4] - 8,
      align: 'right',
    });

    rowY += rowH;
  }

  // ===== Notas (izq) y totales (der) =====
  const footerTop = rowY + 18;

  // Caja notas (izquierda) — borde rojo redondeado
  const notesW = W / 2 - 12;
  const notesX = M;

  // Construir contenido de notas
  const notesLines: { text: string; bold?: boolean }[] = [];
  if (p.creditTerm) notesLines.push({ text: `• Plazo de credito: ${p.creditTerm}` });
  if (p.paymentTerms) notesLines.push({ text: `• Forma de pago: ${p.paymentTerms}` });
  if (p.validity) notesLines.push({ text: `• Vigencia de la oferta: ${p.validity}` });
  if (p.topClients) {
    notesLines.push({ text: '' });
    notesLines.push({ text: 'PRINCIPALES CLIENTES:', bold: true });
    for (const c of p.topClients.split('\n').filter(Boolean)) {
      notesLines.push({ text: `• ${c.trim()}` });
    }
  }

  // Calcular alto de la caja de notas
  let notesH = 16;
  for (const l of notesLines) {
    if (l.text === '') {
      notesH += 6;
      continue;
    }
    notesH += 12;
  }
  notesH = Math.max(notesH, 90);

  // Dibujar borde redondeado
  doc.roundedRect(notesX, footerTop, notesW, notesH, 12).lineWidth(1.5).strokeColor(RED).stroke();

  let ny = footerTop + 10;
  doc.font('Helvetica').fontSize(8.5).fillColor(DARK);
  for (const l of notesLines) {
    if (l.text === '') {
      ny += 6;
      continue;
    }
    if (l.bold) doc.font('Helvetica-Bold');
    else doc.font('Helvetica');
    doc.text(l.text, notesX + 12, ny, { width: notesW - 24 });
    ny += 12;
  }

  // Totales (derecha)
  const iva = subtotal * (p.ivaPercent / 100);
  const total = subtotal + iva;
  const totalsX = M + W / 2 + 12;
  const totalsW = W / 2 - 12;
  const labelW = totalsW / 2;
  const valueW = totalsW / 2;
  let ty = footerTop;

  function totalsRow(label: string, value: string, bold = false, accent = false) {
    if (accent) {
      doc.rect(totalsX, ty - 2, totalsW, 24).fill(SOFT_BG);
    }
    doc
      .fillColor(accent ? RED : DARK)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(accent ? 12 : 10)
      .text(label, totalsX, ty + 4, { width: labelW, align: 'left' });
    doc
      .fillColor(accent ? RED : DARK)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(accent ? 12 : 10)
      .text(`$ ${value}`, totalsX + labelW, ty + 4, { width: valueW, align: 'right' });
    ty += 24;
  }

  totalsRow('SUBTOTAL:', formatMoney(subtotal), true);
  doc
    .moveTo(totalsX, ty - 2)
    .lineTo(totalsX + totalsW, ty - 2)
    .lineWidth(0.5)
    .strokeColor(LIGHT_GRAY)
    .stroke();
  totalsRow(`IVA ${p.ivaPercent}%`, formatMoney(iva), true);
  doc
    .moveTo(totalsX, ty - 2)
    .lineTo(totalsX + totalsW, ty - 2)
    .lineWidth(0.5)
    .strokeColor(LIGHT_GRAY)
    .stroke();
  totalsRow('TOTAL:', formatMoney(total), true, true);

  // Firma
  const signY = Math.max(footerTop + notesH, ty) + 30;
  doc
    .moveTo(totalsX + 30, signY)
    .lineTo(totalsX + totalsW - 30, signY)
    .lineWidth(0.5)
    .strokeColor(DARK)
    .stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(DARK)
    .text(p.signerName || 'Gabriel Constantine L.', totalsX, signY + 6, {
      width: totalsW,
      align: 'center',
    });
  doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(
    p.signerTitle || 'Gerente General',
    totalsX,
    signY + 20,
    { width: totalsW, align: 'center' },
  );

  doc.end();
}
