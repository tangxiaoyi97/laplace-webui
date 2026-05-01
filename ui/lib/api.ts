const TOKEN_KEY = 'laplace_token';

export function getStoredToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getApiUrl(path: string): string {
  return `/api${path}`;
}

export function getAuthHeaderValue(): string {
  const token = getStoredToken();
  return token ? `Bearer ${token}` : '';
}

export function getAuthHeaders(extra: HeadersInit = {}): HeadersInit {
  const authorization = getAuthHeaderValue();
  if (!authorization) {
    return extra;
  }
  return {
    Authorization: authorization,
    ...extra,
  };
}

function toBase64Url(value: string): string {
  const utf8 = new TextEncoder().encode(value);
  let binary = '';
  utf8.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function getWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
}

export function getWebSocketProtocol(): string | null {
  const token = getStoredToken();
  if (!token) return null;
  return `laplace-auth.${toBase64Url(`laplace@${token}`)}`;
}

export async function fetchAuthed(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(getApiUrl(path), {
    ...init,
    headers: getAuthHeaders(init.headers || {}),
  });
}

/**
 * Append `?serverId=` to a path. Used by feature views to scope every request
 * to the user's currently selected server. If no serverId is given returns the
 * path untouched (the backend will fall back to the configured default).
 */
export function withServerId(path: string, serverId: string | null | undefined): string {
  if (!serverId) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}serverId=${encodeURIComponent(serverId)}`;
}

/** GET helper that scopes by serverId. */
export function fetchScoped(path: string, serverId: string | null | undefined, init: RequestInit = {}): Promise<Response> {
  return fetchAuthed(withServerId(path, serverId), init);
}

/** POST/PATCH helper that injects {serverId} into a JSON body. */
export function postScoped(path: string, serverId: string | null | undefined, body: any, extra: RequestInit = {}): Promise<Response> {
  const merged = { serverId: serverId ?? undefined, ...(body || {}) };
  return fetchAuthed(path, {
    ...extra,
    method: extra.method || 'POST',
    headers: { 'Content-Type': 'application/json', ...(extra.headers || {}) },
    body: JSON.stringify(merged),
  });
}

/**
 * Normalise pasted tokens. Users sometimes paste `laplace@<uuid>` (the full
 * Auth String emitted by the TUI), trailing whitespace, or surrounding quotes.
 * Reduce all of those to the bare credential the backend expects.
 */
export function normalizeTokenInput(raw: string): string {
  let t = (raw || '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(t)) t = t.replace(/^bearer\s+/i, '').trim();
  if (/^laplace@/i.test(t)) t = t.replace(/^laplace@/i, '').trim();
  return t;
}

/**
 * Verify a token without committing it to localStorage. Returns a discriminated
 * result the UI can map to a clear error message.
 */
export type TokenCheckResult =
  | { ok: true }
  | { ok: false; kind: 'rejected'; status: number; message: string }
  | { ok: false; kind: 'network'; message: string };

export async function checkToken(token: string): Promise<TokenCheckResult> {
  if (!token) return { ok: false, kind: 'rejected', status: 0, message: 'Token is empty.' };
  try {
    const res = await fetch(getApiUrl('/auth/check'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        kind: 'rejected',
        status: res.status,
        message: 'This token was rejected. Run `user token admin` in the TUI to mint a fresh one and paste only the UUID — drop any laplace@ prefix.',
      };
    }
    return {
      ok: false,
      kind: 'rejected',
      status: res.status,
      message: `Auth check failed with HTTP ${res.status}.`,
    };
  } catch (e: any) {
    return {
      ok: false,
      kind: 'network',
      message: 'Could not reach laplace-core. Make sure the panel is running on this port.',
    };
  }
}
