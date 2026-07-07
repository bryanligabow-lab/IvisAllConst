/* eslint-disable @typescript-eslint/no-require-imports */
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { toRenderableImage } from '../../shared/utils/image.util';
import { buildAttachment } from './proforma-filename';
import { computeProformaTotals } from './proforma-totals';

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
      images: { orderBy: { orderIndex: 'asc' } },
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
  res.setHeader('Content-Disposition', buildAttachment(p, 'pdf'));
  doc.pipe(res);

  const PAGE_W = doc.page.width;
  const PAGE_H = doc.page.height;
  const M = 40;
  const W = PAGE_W - M * 2;

  // ===== Encabezado: logo izq + PROFORMA der =====
  const headerY = M;
  if (fs.existsSync(LOGO_PATH)) {
    try {
      doc.image(LOGO_PATH, M, headerY - 6, { fit: [360, 120] });
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
    .fontSize(32)
    .text('PROFORMA', rightX - 260, headerY + 8, { width: 260, align: 'right', lineBreak: false });
  doc
    .fillColor(DARK)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(`No. ${p.number}`, rightX - 260, headerY + 50, {
      width: 260,
      align: 'right',
      lineBreak: false,
    });

  // Línea separadora (debajo del logo, que ahora es más grande)
  doc
    .moveTo(M, headerY + 120)
    .lineTo(M + W, headerY + 120)
    .lineWidth(1.5)
    .strokeColor(RED)
    .stroke();

  // Fecha
  doc
    .fillColor(DARK)
    .font('Helvetica')
    .fontSize(9)
    .text(formatDateLong(p.date), M, headerY + 126, { width: W, align: 'right' });

  // ===== Emisor (izq) + Cliente (der) =====
  const blockY = headerY + 144;
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10).text('CREA INNOVACION PROYECTOS Y SERVICIOS', M, blockY);
  doc.font('Helvetica-Bold').text('CREACOM S.A.', M, blockY + 12);
  doc.font('Helvetica').fontSize(9).fillColor(DARK);
  doc.text('RUC: 0993273708001', M, blockY + 26);
  doc.text('AUT SRI: 31234567817', M, blockY + 38);
  doc.text('DIRECCION: AV. GUAYAQUIL, ED. MARCIMEX', M, blockY + 50);

  // Cliente (der) — alturas dinámicas para que un nombre/dirección largo
  // no se monte con la línea siguiente.
  const clientX = M + W / 2 + 10;
  const clientW = W / 2 - 10;
  let cy = blockY;
  const drawClientLine = (text: string, bold = false, size = 9) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(DARK);
    const h = doc.heightOfString(text, { width: clientW, align: 'right' });
    doc.text(text, clientX, cy, { width: clientW, align: 'right' });
    cy += h + 2;
  };
  drawClientLine(p.clientName.toUpperCase(), true, 10);
  if (p.clientRuc) drawClientLine(`RUC: ${p.clientRuc}`);
  if (p.clientAddress) drawClientLine(`DIRECCION: ${p.clientAddress}`);
  if (p.projectLabel || p.project)
    drawClientLine(`PROYECTO: ${p.projectLabel || p.project?.name}`);
  if (p.clientResponsible) drawClientLine(`RESPONSABLE: ${p.clientResponsible}`);
  const clientBottom = cy;

  // ===== Tabla ===== (debajo del bloque más alto: emisor o cliente)
  const emitterBottom = blockY + 62;
  const tableTop = Math.max(emitterBottom, clientBottom) + 22;
  const colX = [M, M + 50, M + 100, M + W - 200, M + W - 100, M + W];
  const colWidths = [50, 50, W - 250, 100, 100];

  // Header rojo
  doc.rect(M, tableTop, W, 28).fill(RED);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
  const headerTextY = tableTop + 10;
  doc.text('CANT', colX[0], headerTextY, { width: colWidths[0], align: 'center' });
  doc.text('UNI', colX[1], headerTextY, { width: colWidths[1], align: 'center' });
  doc.text('DETALLE', colX[2] + 4, headerTextY, { width: colWidths[2] - 8, align: 'left' });
  doc.text('V. UNITARIO', colX[3], headerTextY, { width: colWidths[3], align: 'center' });
  doc.text('V. TOTAL', colX[4], headerTextY, { width: colWidths[4], align: 'center' });

  // Pre-convertir cada imagen a PNG/JPEG (pdfkit no dibuja AVIF/WebP/HEIC…).
  const renderable = new Map<string, Buffer>();
  for (const img of p.images) {
    const r = await toRenderableImage(Buffer.from(img.data), img.mimeType);
    renderable.set(img.id, r.buffer);
  }

  // Agrupar imágenes: por rubro (itemIndex) vs generales (sin ítem → al final).
  const imagesByItem = new Map<number, typeof p.images>();
  const generalImages: typeof p.images = [];
  for (const img of p.images) {
    if (img.itemIndex == null) {
      generalImages.push(img);
    } else {
      const arr = imagesByItem.get(img.itemIndex) ?? [];
      arr.push(img);
      imagesByItem.set(img.itemIndex, arr);
    }
  }

  // Filas
  let rowY = tableTop + 28;
  let subtotal = 0;
  doc.fillColor(DARK).font('Helvetica').fontSize(9);

  const detalleW = colWidths[2];
  for (const [idx, it] of p.items.entries()) {
    const totalLine = it.quantity * it.unitPrice;
    subtotal += totalLine;

    const imgs = imagesByItem.get(idx) ?? [];
    const hasImg = imgs.length > 0;

    // Si el rubro tiene imagen: texto a la izquierda, imagen a la derecha del detalle.
    const imgBoxH = 62;
    const textW = hasImg ? Math.round(detalleW * 0.55) : detalleW;
    const imgAreaX = colX[2] + textW + 8;
    const imgAreaW = detalleW - textW - 8;

    const detailH = doc.heightOfString(it.description, { width: textW - 8 });
    const contentH = hasImg ? Math.max(detailH, imgBoxH) : detailH;
    const rowH = Math.max(24, contentH + 12);

    // Llenar la página hasta el fondo (deja solo el margen) antes de saltar.
    if (rowY + rowH > PAGE_H - M) {
      doc.addPage();
      rowY = M;
    }

    // Línea inferior
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
    doc.text(it.description, colX[2] + 4, rowY + 8, {
      width: textW - 8,
      align: 'left',
    });

    // Imagen(es) del rubro, al lado de la descripción.
    if (hasImg) {
      const n = Math.min(imgs.length, 3);
      const gap = 4;
      const cw = (imgAreaW - gap * (n - 1)) / n;
      for (let k = 0; k < n; k++) {
        const buf = renderable.get(imgs[k].id);
        if (!buf) continue;
        try {
          doc.image(buf, imgAreaX + k * (cw + gap), rowY + 7, {
            fit: [cw, imgBoxH],
            align: 'center',
            valign: 'center',
          });
        } catch {
          /* ignore */
        }
      }
      doc.fillColor(DARK).font('Helvetica').fontSize(9);
    }

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

  // ===== Imágenes referenciales (junto a la descripción, misma página) =====
  let footerTop = rowY + 18;
  if (generalImages.length > 0) {
    const perRow = Math.min(generalImages.length, 3);
    const gap = 12;
    const cellW = (W - gap * (perRow - 1)) / perRow;
    const boxH = generalImages.length === 1 ? 120 : 90;
    const rows = Math.ceil(generalImages.length / perRow);
    const bandH = 16 + rows * (boxH + 22);

    // Si el bloque de imágenes no cabe en la página, pasa a una nueva.
    if (footerTop + bandH > PAGE_H - M) {
      doc.addPage();
      footerTop = M;
    }

    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(9).text('IMAGEN REFERENCIAL', M, footerTop);
    let iy = footerTop + 14;
    let icol = 0;
    for (const img of generalImages) {
      const ix = M + icol * (cellW + gap);
      const buf = renderable.get(img.id) ?? Buffer.from(img.data);
      try {
        doc.image(buf, ix, iy, {
          fit: [cellW, boxH],
          align: 'center',
          valign: 'center',
        });
      } catch {
        doc
          .fillColor(GRAY)
          .font('Helvetica')
          .fontSize(8)
          .text('(No se pudo cargar la imagen)', ix, iy + boxH / 2, {
            width: cellW,
            align: 'center',
          });
      }
      if (img.caption) {
        doc
          .fillColor(GRAY)
          .font('Helvetica-Oblique')
          .fontSize(8)
          .text(img.caption, ix, iy + boxH + 2, { width: cellW, align: 'center' });
      }
      icol++;
      if (icol === perRow) {
        icol = 0;
        iy += boxH + 22;
      }
    }
    if (icol !== 0) iy += boxH + 22;
    footerTop = iy + 8;
  }

  // Totales con IVA por rubro (desglose por tarifa).
  const totals = computeProformaTotals(p.items, p.ivaPercent);
  // Filas de totales: un subtotal por categoría + un IVA por cada categoría
  // que lleve IVA (los "No objeto"/"Exento" no llevan fila de IVA) + el TOTAL.
  const ivaRowsCount = totals.breakdown.filter((b) => b.ivaLine).length;
  const totalsRowsH = (totals.breakdown.length + ivaRowsCount + 1) * 24 + 8;

  // Si no queda espacio para notas/totales, pásalos a una página nueva.
  if (footerTop > PAGE_H - Math.max(210, totalsRowsH + 70)) {
    doc.addPage();
    footerTop = M;
  }

  // ===== Notas (izq) y totales (der) =====

  // Caja notas (izquierda) — borde rojo redondeado
  const notesW = W / 2 - 12;
  const notesX = M;

  // Construir contenido de notas
  const notesLines: { text: string; bold?: boolean }[] = [];
  if (p.creditTerm) notesLines.push({ text: `• Plazo de credito: ${p.creditTerm}` });
  if (p.paymentTerms) notesLines.push({ text: `• Forma de pago: ${p.paymentTerms}` });
  if (p.validity) notesLines.push({ text: `• Vigencia de la oferta: ${p.validity}` });
  if (p.deliveryTime) notesLines.push({ text: `• Tiempo de entrega: ${p.deliveryTime}` });
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
  const totalsX = M + W / 2 + 12;
  const totalsW = W / 2 - 12;
  // Más ancho para la etiqueta (los textos largos como "SUBTOTAL No objeto de
  // IVA:" se partían en dos líneas). El valor va a la derecha en su franja.
  const labelW = totalsW * 0.66;
  const valueW = totalsW * 0.34;
  let ty = footerTop;

  function totalsRow(label: string, value: string, bold = false, accent = false) {
    if (accent) {
      doc.rect(totalsX, ty - 2, totalsW, 24).fill(SOFT_BG);
    }
    // Fuente un poco menor en las etiquetas normales para que quepan en una línea.
    const labelSize = accent ? 12 : label.length > 20 ? 8.5 : 10;
    doc
      .fillColor(accent ? RED : DARK)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(labelSize)
      .text(label, totalsX, ty + 5, { width: labelW, align: 'left', lineBreak: false });
    doc
      .fillColor(accent ? RED : DARK)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(accent ? 12 : 10)
      .text(`$ ${value}`, totalsX + labelW, ty + 4, { width: valueW, align: 'right' });
    ty += 24;
  }

  const sep = () =>
    doc
      .moveTo(totalsX, ty - 2)
      .lineTo(totalsX + totalsW, ty - 2)
      .lineWidth(0.5)
      .strokeColor(LIGHT_GRAY)
      .stroke();

  // Un subtotal por cada categoría (SUBTOTAL 15%, SUBTOTAL 0%, SUBTOTAL No objeto de IVA, …).
  for (const b of totals.breakdown) {
    totalsRow(`SUBTOTAL ${b.label}:`, formatMoney(b.base), true);
    sep();
  }
  // Un IVA por cada categoría que lleve IVA (los especiales no suman IVA).
  for (const b of totals.breakdown) {
    if (!b.ivaLine) continue;
    totalsRow(`IVA ${b.label}`, formatMoney(b.iva), true);
    sep();
  }
  totalsRow('TOTAL:', formatMoney(totals.total), true, true);

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
