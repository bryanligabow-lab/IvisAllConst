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

async function tryRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as ApiResponse<{ accessToken: string }>;
    if (!body.success) return null;
    setAccessToken(body.data.accessToken);
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

export const apiGet = <T>(path: string) => apiFetch<T>(path);
export const apiPost = <T>(path: string, data: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(data) });
export const apiPatch = <T>(path: string, data: unknown) =>
  apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(data) });
export const apiDelete = <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' });
