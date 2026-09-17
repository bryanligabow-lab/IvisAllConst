/**
 * Limpieza de texto pegado desde Excel, Word o WhatsApp.
 *
 * Al copiar una celda de Excel suele venir un TABULADOR al inicio ("\tPintura
 * Exterior"). pdfkit no tiene glifo para el tab con las fuentes estándar y
 * desordena las letras que siguen: "Pintura Exterior" salía como
 * "• –çGW a Exterior". Lo mismo con otros caracteres de control o invisibles.
 */

// Caracteres de control salvo el salto de línea (\n), que sí se usa en los rubros.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g;
// Espacios de ancho cero, marcas de dirección y BOM.
const INVISIBLES = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
// Espacios "raros" (no separable, delgado, etc.) → espacio normal.
const ESPACIOS = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

/** Deja el texto limpio conservando los saltos de línea. */
export function limpiarTexto(valor: string | null | undefined): string {
  if (!valor) return '';
  return valor
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLES, '')
    .replace(CONTROL, ' ')
    .replace(ESPACIOS, ' ')
    .split('\n')
    .map((linea) => linea.replace(/ {2,}/g, ' ').trim())
    .join('\n')
    .trim();
}

// Caracteres fuera de Latin-1 que la codificación WinAnsi de las fuentes
// estándar del PDF sí sabe dibujar (comillas tipográficas, guiones, €, …).
const WIN_ANSI_EXTRA = new Set(
  [
    0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039,
    0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122,
    0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
  ].map((c) => String.fromCodePoint(c)),
);

/**
 * Para las fuentes estándar del PDF (codificación WinAnsi): además de limpiar,
 * convierte letras "decoradas" a su forma normal (negritas de WhatsApp o de
 * generadores de letras → texto normal) y quita lo que no se puede dibujar
 * (emojis), en vez de imprimir basura.
 */
export function textoParaPdf(valor: string | null | undefined): string {
  return [...limpiarTexto(valor).normalize('NFKC')]
    .filter((c) => {
      const code = c.codePointAt(0) ?? 0;
      return c === '\n' || (code >= 0x20 && code <= 0xff) || WIN_ANSI_EXTRA.has(c);
    })
    .join('')
    .replace(/ {2,}/g, ' ');
}
