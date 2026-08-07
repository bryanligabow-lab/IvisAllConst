// Recuerda qué proyectos abrió el usuario y cuándo (por navegador). Sirve para
// que en el dashboard salgan PRIMERO los últimos que se abrieron/trabajaron, y
// los inactivos bajen. Es por dispositivo (localStorage), no se comparte.

const KEY = 'recent-projects';
const MAX = 20; // no guardamos historial infinito

type RecentMap = Record<string, number>; // projectId -> timestamp (ms)

export function getRecentProjects(): RecentMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentMap) : {};
  } catch {
    return {};
  }
}

export function markProjectOpened(id: string): RecentMap {
  if (typeof window === 'undefined') return {};
  const map = getRecentProjects();
  map[id] = Date.now();
  // Conservar solo los MAX más recientes.
  const trimmed: RecentMap = Object.fromEntries(
    Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX),
  );
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* almacenamiento lleno o bloqueado: no pasa nada */
  }
  return trimmed;
}
