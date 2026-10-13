/** Alineación del detalle de un rubro en el PDF y el Excel. */
export type AlineacionRubro = 'left' | 'center' | 'right';

/**
 * Qué alineación usar para un rubro.
 *
 * `textAlign` null significa AUTOMÁTICO, que es como se comportaban las
 * proformas antes de que esto existiera: un detalle de una sola línea va
 * centrado (es el formato de toda la vida), pero uno de varias líneas —una
 * lista de lo que incluye el rubro, por ejemplo— se ve mal centrado, así que
 * va a la izquierda.
 */
export function alineacionDe(
  textAlign: string | null | undefined,
  description: string,
): AlineacionRubro {
  const v = (textAlign ?? '').toUpperCase();
  if (v === 'LEFT') return 'left';
  if (v === 'RIGHT') return 'right';
  if (v === 'CENTER') return 'center';
  return description.includes('\n') ? 'left' : 'center';
}
