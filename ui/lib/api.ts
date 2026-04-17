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
