import sharp from 'sharp';

/**
 * pdfkit (PDF) y exceljs (Excel) SOLO soportan PNG y JPEG. Si una imagen viene
 * en otro formato (AVIF, WebP, HEIC, GIF…), la convertimos a PNG para que se
 * pueda renderizar. Si la conversión falla, se devuelve el buffer original.
 */
export async function toRenderableImage(
  data: Buffer,
  mime: string | null | undefined,
): Promise<{ buffer: Buffer; ext: 'png' | 'jpeg' }> {
  const m = (mime ?? '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return { buffer: data, ext: 'jpeg' };
  if (m === 'image/png') return { buffer: data, ext: 'png' };
  try {
    const png = await sharp(data).png().toBuffer();
    return { buffer: png, ext: 'png' };
  } catch {
    // No se pudo convertir: devolvemos el original (mejor intentar que nada).
    return { buffer: data, ext: 'png' };
  }
}
