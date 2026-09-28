import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { limpiarTexto } from '../../shared/utils/text.util';

/**
 * Carga de rubros desde un archivo (Excel o CSV) para no tener que teclear
 * uno por uno. El formato esperado es el de la plantilla que se descarga
 * desde el mismo botón: una fila por rubro y nada más.
 */

const RED = 'FFC73E2C';
const WHITE = 'FFFFFFFF';
const SOFT = 'FFFCEDEA';

export interface RubroImportado {
  quantity: number;
  unit: string;
  description: string;
  unitPrice: number;
  /** '15' | '0' | 'NO_OBJETO' | 'EXENTO' | null (null = usa el IVA general) */
  vatMode: string | null;
}

export interface ResultadoImport {
  items: RubroImportado[];
  avisos: string[];
}

// Encabezados que reconocemos, en minúsculas y sin acentos.
const COLUMNAS: { campo: keyof RubroImportado | 'total'; claves: string[] }[] = [
  { campo: 'quantity', claves: ['cantidad', 'cant', 'cant.', 'qty'] },
  { campo: 'unit', claves: ['unidad', 'und', 'uni', 'und.', 'uni.', 'u/m', 'medida'] },
  { campo: 'description', claves: ['detalle', 'descripcion', 'rubro', 'concepto', 'item'] },
  { campo: 'unitPrice', claves: ['valor unitario', 'v. unitario', 'v unitario', 'precio unitario', 'p. unitario', 'p unitario', 'unitario', 'precio'] },
  { campo: 'total', claves: ['valor total', 'v. total', 'v total', 'total', 'importe'] },
  { campo: 'vatMode', claves: ['iva', 'iva %', '% iva', 'tarifa'] },
];

// Filas que NO son rubros (los totales del documento original).
const NO_ES_RUBRO = /^(sub\s*total|subtotal|iva|total|son:|observaci)/i;

function normalizar(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Acepta 1234.56, "1.234,56", "$ 1.234,56", "12,5" y celdas numéricas de Excel. */
export function aNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  // Celda con fórmula: exceljs devuelve { result } o { formula }
  if (typeof valor === 'object') {
    const obj = valor as { result?: unknown; text?: unknown };
    if (obj.result !== undefined) return aNumero(obj.result);
    if (obj.text !== undefined) return aNumero(obj.text);
    return null;
  }
  let t = String(valor).replace(/[$\s]/g, '').replace(/[()]/g, '');
  if (!t || t === '-') return null;
  const tieneComa = t.includes(',');
  const tienePunto = t.includes('.');
  if (tieneComa && tienePunto) {
    // El separador decimal es el que aparece más a la derecha.
    t = t.lastIndexOf(',') > t.lastIndexOf('.')
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '');
  } else if (tieneComa) {
    // "1,5" es decimal; "1,650" con 3 dígitos detrás es separador de miles.
    t = /,\d{3}$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function textoCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object') {
    const obj = valor as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (Array.isArray(obj.richText)) return limpiarTexto(obj.richText.map((r) => r.text).join(''));
    if (obj.text !== undefined) return limpiarTexto(String(obj.text));
    if (obj.result !== undefined) return limpiarTexto(String(obj.result));
    return '';
  }
  return limpiarTexto(String(valor));
}

/** Normaliza lo que venga en la columna IVA a los modos que usa el formulario. */
function modoIva(valor: unknown): string | null {
  const t = normalizar(valor);
  if (!t) return null;
  if (t.includes('no objeto')) return 'NO_OBJETO';
  if (t.includes('exent')) return 'EXENTO';
  const n = aNumero(valor);
  if (n === null) return null;
  return n > 1 ? String(Math.round(n)) : String(Math.round(n * 100));
}

/** Lee un CSV simple (separador , o ;) respetando las comillas. */
function filasDeCsv(texto: string): string[][] {
  const limpio = texto.replace(/^\uFEFF/, '');
  const sep = (limpio.split('\n')[0].match(/;/g)?.length ?? 0) > (limpio.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const filas: string[][] = [];
  let campo = '';
  let fila: string[] = [];
  let enComillas = false;
  for (let i = 0; i < limpio.length; i += 1) {
    const c = limpio[i];
    if (enComillas) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i += 1; }
      else if (c === '"') enComillas = false;
      else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  fila.push(campo);
  if (fila.some((x) => x.trim())) filas.push(fila);
  return filas;
}

/** Una fila del archivo con su número real, para poder citarlo en los avisos. */
interface FilaArchivo {
  numero: number;
  celdas: unknown[];
}

/** Pasa el archivo a filas, venga de Excel o de CSV. */
async function filasDelArchivo(buffer: Buffer, filename: string): Promise<FilaArchivo[]> {
  if (/\.csv$/i.test(filename)) {
    return filasDeCsv(buffer.toString('utf8')).map((celdas, i) => ({ numero: i + 1, celdas }));
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const hoja = wb.worksheets.find((w) => w.rowCount > 1) ?? wb.worksheets[0];
  if (!hoja) return [];
  const filas: FilaArchivo[] = [];
  hoja.eachRow({ includeEmpty: false }, (row) => {
    // exceljs deja el índice 0 vacío; row.number es la fila real de la hoja.
    filas.push({ numero: row.number, celdas: (row.values as unknown[]).slice(1) });
  });
  return filas;
}

/**
 * Busca la fila de encabezados y devuelve en qué columna quedó cada campo.
 * Así da igual el orden de las columnas o que el archivo traiga un membrete
 * arriba (como las proformas viejas de la empresa).
 */
function ubicarColumnas(filas: FilaArchivo[]): { fila: number; mapa: Record<string, number> } | null {
  for (let f = 0; f < Math.min(filas.length, 30); f += 1) {
    const mapa: Record<string, number> = {};
    filas[f].celdas.forEach((celda, c) => {
      const t = normalizar(textoCelda(celda));
      if (!t) return;
      for (const col of COLUMNAS) {
        if (mapa[col.campo] !== undefined) continue;
        if (col.claves.some((k) => t === k || t.startsWith(k + ' ') || t === k.replace('.', ''))) {
          mapa[col.campo] = c;
          return;
        }
      }
    });
    // Sirve si al menos reconocemos el detalle y algo de plata o cantidad.
    if (mapa.description !== undefined && (mapa.unitPrice !== undefined || mapa.total !== undefined || mapa.quantity !== undefined)) {
      return { fila: f, mapa };
    }
  }
  return null;
}

/** Lee los rubros del archivo. NO toca la base: solo devuelve lo que entendió. */
export async function parsearRubros(buffer: Buffer, filename: string): Promise<ResultadoImport> {
  const filas = await filasDelArchivo(buffer, filename);
  const avisos: string[] = [];
  if (filas.length === 0) return { items: [], avisos: ['El archivo llegó vacío.'] };

  const encabezado = ubicarColumnas(filas);
  if (!encabezado) {
    return {
      items: [],
      avisos: [
        'No se encontraron las columnas. Descarga la plantilla y usa esos mismos títulos: CANTIDAD, UNIDAD, DETALLE, VALOR UNITARIO e IVA.',
      ],
    };
  }

  const { mapa } = encabezado;
  const items: RubroImportado[] = [];
  for (let f = encabezado.fila + 1; f < filas.length; f += 1) {
    const { celdas: fila, numero } = filas[f];
    const descripcion = textoCelda(mapa.description !== undefined ? fila[mapa.description] : '');
    if (!descripcion) continue;
    if (NO_ES_RUBRO.test(descripcion)) continue; // fila de totales del documento

    const cantidad = mapa.quantity !== undefined ? aNumero(fila[mapa.quantity]) : null;
    let unitario = mapa.unitPrice !== undefined ? aNumero(fila[mapa.unitPrice]) : null;
    const total = mapa.total !== undefined ? aNumero(fila[mapa.total]) : null;

    const cant = cantidad ?? 1;
    // Si no vino el precio unitario pero sí el total, se deduce (y si el
    // unitario redondeado no reproduce el total, manda el total).
    if (unitario === null && total !== null && cant > 0) {
      unitario = Number((total / cant).toFixed(6));
    } else if (unitario !== null && total !== null && cant > 0) {
      if (Math.abs(Number((cant * unitario).toFixed(2)) - total) > 0.005) {
        unitario = Number((total / cant).toFixed(6));
        avisos.push(`Fila ${numero} (${descripcion.slice(0, 40)}): se usó el VALOR TOTAL para que cuadre.`);
      }
    }
    if (unitario === null) {
      unitario = 0;
      avisos.push(`Fila ${numero} (${descripcion.slice(0, 40)}): sin precio, quedó en $0.`);
    }

    items.push({
      quantity: cant,
      unit: textoCelda(mapa.unit !== undefined ? fila[mapa.unit] : '').slice(0, 60) || 'GBL',
      description: descripcion.slice(0, 5000),
      unitPrice: Math.max(0, unitario),
      vatMode: mapa.vatMode !== undefined ? modoIva(fila[mapa.vatMode]) : null,
    });
  }

  if (items.length === 0) avisos.push('Se encontraron las columnas pero ninguna fila con detalle.');
  if (avisos.length > 8) avisos.splice(8, avisos.length - 8, `… y ${avisos.length - 8} aviso(s) más.`);
  return { items, avisos };
}

/** Plantilla .xlsx: cómo debe venir ordenada la data para poder subirla. */
export async function exportImportTemplate(res: Response): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CREACOM S.A.';
  wb.created = new Date();

  const hoja = wb.addWorksheet('Rubros', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.columns = [
    { header: 'CANTIDAD', key: 'cant', width: 12 },
    { header: 'UNIDAD', key: 'uni', width: 12 },
    { header: 'DETALLE', key: 'det', width: 58 },
    { header: 'VALOR UNITARIO', key: 'pu', width: 18 },
    { header: 'IVA', key: 'iva', width: 14 },
  ];
  hoja.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  hoja.getRow(1).height = 22;

  const ejemplos = [
    [100, 'MTS', 'CABLE 1/0', 16.5, 15],
    [4, 'UND', 'GRILLETE P/VARILLA', 3.2, 15],
    [1, 'GBL', 'Instalación de cocina y anaqueles', 521.8, 15],
    [2, 'UND', 'Rubro sin IVA (ejemplo)', 80, 0],
  ];
  for (const e of ejemplos) {
    const r = hoja.addRow(e);
    r.getCell(4).numFmt = '"$"#,##0.00';
    r.getCell(5).alignment = { horizontal: 'center' };
    r.font = { color: { argb: 'FF9A9A9A' }, italic: true };
  }

  const nota = hoja.addRow([]);
  nota.getCell(1).value = '↑ Borra estas 4 filas de ejemplo y escribe las tuyas debajo del encabezado.';
  hoja.mergeCells(nota.number, 1, nota.number, 5);
  nota.getCell(1).font = { italic: true, color: { argb: RED } };

  // ---------- Instrucciones ----------
  const guia = wb.addWorksheet('Cómo llenarla');
  guia.columns = [{ width: 4 }, { width: 100 }];
  const linea = (texto: string, opciones?: { titulo?: boolean; vinneta?: boolean }) => {
    const r = guia.addRow(['', texto]);
    if (opciones?.titulo) {
      r.getCell(2).font = { bold: true, size: 12, color: { argb: RED } };
    } else if (opciones?.vinneta) {
      r.getCell(2).value = `•  ${texto}`;
    }
    r.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    return r;
  };

  linea('CÓMO SUBIR RUBROS AL SISTEMA', { titulo: true });
  guia.addRow([]);
  linea('1. Llena la hoja "Rubros": una fila por cada rubro, sin dejar filas vacías en medio.', { vinneta: true });
  linea('2. No cambies los títulos del encabezado. El orden de las columnas sí puede variar.', { vinneta: true });
  linea('3. Guarda el archivo (.xlsx o .csv).', { vinneta: true });
  linea('4. En Proformas, toca "⬆ Subir desde archivo" y elígelo. Los rubros entran al formulario y ahí revisas antes de crear la proforma.', { vinneta: true });
  guia.addRow([]);
  linea('QUÉ VA EN CADA COLUMNA', { titulo: true });
  guia.addRow([]);
  linea('CANTIDAD — solo el número (100, 2, 0.5). Si va vacía se toma 1.', { vinneta: true });
  linea('UNIDAD — UND, MTS, GBL, M2, KLS, RLL… Si va vacía se pone GBL.', { vinneta: true });
  linea('DETALLE — el nombre del rubro. Es la única columna obligatoria.', { vinneta: true });
  linea('VALOR UNITARIO — el precio de UNA unidad, sin el signo $. El sistema multiplica por la cantidad.', { vinneta: true });
  linea('IVA — 15 o 0. También acepta "NO OBJETO" y "EXENTO". Si la dejas vacía usa el IVA general de la proforma.', { vinneta: true });
  guia.addRow([]);
  linea('COSAS QUE CONVIENE SABER', { titulo: true });
  guia.addRow([]);
  linea('No pongas filas de SUBTOTAL, IVA ni TOTAL: el sistema las ignora y calcula los totales solo.', { vinneta: true });
  linea('Si tu archivo trae una columna VALOR TOTAL, también se lee: cuando el precio unitario no cuadra con el total, manda el total.', { vinneta: true });
  linea('Puedes pegar los rubros desde otro Excel; los tabuladores y espacios raros se limpian solos.', { vinneta: true });
  linea('Las fotos de cada rubro se agregan después, en el formulario de la proforma.', { vinneta: true });

  guia.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  guia.getRow(1).height = 24;
  for (let i = 1; i <= guia.rowCount; i += 1) {
    guia.getRow(i).getCell(2).fill = i === 1 ? { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } } : guia.getRow(i).getCell(2).fill;
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Plantilla de rubros - CREACOM.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}
