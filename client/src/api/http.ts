export class ApiError extends Error {
  status: number; code?: string; fields?: Record<string, string>; details?: any;
  constructor(message: string, status: number, code?: string, fields?: Record<string, string>, details?: any) {
    super(message);
    this.status = status; this.code = code; this.fields = fields; this.details = details;
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function http<T>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, unknown> } = {}): Promise<T> {
  const qs = opts.query
    ? '?' + new URLSearchParams(Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false).map(([k, v]) => [k, String(v === true ? 1 : v)])).toString()
    : '';
  let res: Response;
  try {
    res = await fetch(`/api${path}${qs === '?' ? '' : qs}`, {
      method: opts.method ?? 'GET', credentials: 'same-origin',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão.', 0, 'NETWORK');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) onUnauthorized?.();
    throw new ApiError(data?.error ?? 'Erro inesperado. Tente novamente.', res.status, data?.code, data?.fields, data?.details);
  }
  return data as T;
}

export const downloadUrl = (path: string, query: Record<string, string>) => `/api${path}?${new URLSearchParams(query)}`;
