/**
 * Las chequeras reales del grupo (7): una libreta por empresa+banco.
 * Reemplazan el campo libre `bank`, que traía el mismo banco escrito de varias
 * formas ("PAVIMENTACIÓN" vs "PAVIMENTACION BAN ECUADOR").
 */
export const CHEQUERAS_SEED = [
  { id: 'pav-bec', corto: 'Pavimentación · BanEcuador', empresa: 'Pavimentación', banco: 'BanEcuador', orderIndex: 1 },
  { id: 'creacom-bec', corto: 'Creacom · BanEcuador', empresa: 'Creacom', banco: 'BanEcuador', orderIndex: 2 },
  { id: 'creacom-gye', corto: 'Creacom · Guayaquil', empresa: 'Creacom', banco: 'Banco de Guayaquil', orderIndex: 3 },
  { id: 'sumac-bec', corto: 'Sumac · BanEcuador', empresa: 'Sumac', banco: 'BanEcuador', orderIndex: 4 },
  { id: 'all-pacifico', corto: 'All In · Pacífico', empresa: 'All In', banco: 'Banco del Pacífico', orderIndex: 5 },
  { id: 'all-pichincha', corto: 'All In · Pichincha', empresa: 'All In', banco: 'Banco Pichincha', orderIndex: 6 },
  { id: 'sin-asignar', corto: 'Sin asignar', empresa: '—', banco: 'Por identificar', orderIndex: 99 },
] as const;

/**
 * Normaliza el texto libre del banco a un id de chequera. Cubre las variantes
 * que traía el Excel; lo que no reconoce cae en 'sin-asignar'.
 */
export function bankToChequeraId(bank?: string | null): string {
  const b = (bank ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .trim();
  if (!b) return 'sin-asignar';
  const has = (...w: string[]) => w.every((x) => b.includes(x));
  if (has('PAVIMENTACION')) return 'pav-bec';
  if (has('SUMAC')) return 'sumac-bec';
  if (has('CREACOM', 'GUAYAQUIL')) return 'creacom-gye';
  if (has('CREACOM')) return 'creacom-bec';
  if (has('PACIFICO')) return 'all-pacifico';
  if (has('PICHINCHA')) return 'all-pichincha';
  return 'sin-asignar';
}
