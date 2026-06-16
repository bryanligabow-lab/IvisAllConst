import { API_BASE_URL, STORAGE_KEYS } from './constants';

interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: { page: number; perPage: number; total: number; totalPages: number };
}

interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

export class ApiClientError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  else sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

export function setRefreshToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) sessionStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  else sessionStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
}

// Limpia ambos tokens (logout / sesión inválida).
export function clearSession(): void {
  setAccessToken(null);
  setRefreshToken(null);
}

async function tryRefresh(): Promise<string | null> {
  try {
    // Mandamos el refresh token en el body (la cookie es third-party entre los
    // subdominios de Railway y el navegador la bloquea). La cookie queda como
    // respaldo vía credentials:include.
    const stored = getRefreshToken();
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stored ? { refreshToken: stored } : {}),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as ApiResponse<{
      accessToken: string;
      refreshToken?: string;
    }>;
    if (!body.success) return null;
    setAccessToken(body.data.accessToken);
    // El backend rota el refresh token: guardamos el nuevo para el próximo refresh.
    if (body.data.refreshToken) setRefreshToken(body.data.refreshToken);
    return body.data.accessToken;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  // Reintento con refresh si 401
  if (res.status === 401 && !retried) {
    const fresh = await tryRefresh();
    if (fresh) return apiFetch<T>(path, init, true);
  }

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!body) {
    throw new ApiClientError('NETWORK_ERROR', 'Sin respuesta del servidor', res.status);
  }
  if (!body.success) {
    throw new ApiClientError(body.error.code, body.error.message, res.status);
  }
  return body.data;
}

// Descarga binaria (imágenes, archivos) con auth + refresh. Devuelve un Blob.
export async function apiFetchBlob(path: string, retried = false): Promise<Blob> {
  const token = getAccessToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { headers, credentials: 'include' });

  if (res.status === 401 && !retried) {
    const fresh = await tryRefresh();
    if (fresh) return apiFetchBlob(path, true);
  }
  if (!res.ok) {
    throw new ApiClientError('FETCH_ERROR', 'No se pudo cargar el recurso', res.status);
  }
  return res.blob();
}

// Momento (ms epoch) en que expira el access token actual, leído del JWT.
export function getSessionExpiry(): number | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

// Renueva la sesión (nuevo access token) usando el refresh cookie.
// Devuelve true si se pudo ampliar.
export async function refreshSession(): Promise<boolean> {
  const token = await tryRefresh();
  return !!token;
}

export const apiGet = <T>(path: string) => apiFetch<T>(path);
export const apiPost = <T>(path: string, data: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(data) });
export const apiPatch = <T>(path: string, data: unknown) =>
  apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(data) });
export const apiDelete = <T>(path: string, opts?: { deleteCode?: string }) =>
  apiFetch<T>(path, {
    method: 'DELETE',
    headers: opts?.deleteCode ? { 'X-Delete-Code': opts.deleteCode } : undefined,
  });
