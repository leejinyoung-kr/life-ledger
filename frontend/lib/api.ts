/**
 * 백엔드 API fetch 래퍼.
 * localStorage 의 auth_token(access)을 Bearer 로 자동 첨부한다.
 * access 만료(401) 시 httpOnly refresh 쿠키로 /auth/refresh 를 1회 시도해 토큰을 갱신하고 재요청한다.
 * 갱신도 실패하면 토큰 제거 후 로그인 페이지로 보낸다.
 */

import { getVaultToken, requestVaultUnlock } from './vault';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

// 저장된 access 토큰 반환 (브라우저에서만)
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

// 토큰 제거 후 로그인으로 이동
function toLogin(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  }
}

// 동시 다발 401 에서 refresh 가 중복 호출되지 않도록 진행 중 Promise 를 공유
let refreshing: Promise<boolean> | null = null;

// refresh 쿠키로 새 access 발급 시도 — 성공 시 localStorage 갱신
function tryRefresh(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (!refreshing) {
    refreshing = fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return false;
        const body = (await res.json().catch(() => null)) as { token?: string } | null;
        if (!body?.token) return false;
        localStorage.setItem('auth_token', body.token);
        return true;
      })
      .catch(() => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

// 인증 헤더를 붙여 요청하고 JSON 을 반환. 401 이면 refresh 후 1회 재시도. 실패 시 메시지로 throw
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const token = getToken();
  const vault = getVaultToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(vault ? { 'x-vault-token': vault } : {}),
      ...options.headers,
    },
  });

  // access 만료/누락 → refresh 1회 시도 후 재요청, 그래도 실패면 로그인으로
  if (res.status === 401) {
    if (!retried && (await tryRefresh())) {
      return apiFetch<T>(path, options, true);
    }
    toLogin();
    throw new Error('인증이 필요합니다.');
  }

  // 423 보관함 잠김 → 잠금해제 모달 1회 시도 후 재요청
  if (res.status === 423) {
    if (!retried && (await requestVaultUnlock())) {
      return apiFetch<T>(path, options, true);
    }
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? '보관함이 잠겨 있습니다.');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `요청 실패 (${res.status})`);
  }

  // 204 No Content 대비
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// multipart 파일 업로드. FormData 사용 시 Content-Type 을 직접 지정하지 않아야 boundary 가 자동 설정됨
export async function apiUpload<T>(
  path: string,
  file: File,
  field = 'file',
  retried = false,
): Promise<T> {
  const token = getToken();
  const form = new FormData();
  form.append(field, file);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });

  if (res.status === 401) {
    if (!retried && (await tryRefresh())) return apiUpload<T>(path, file, field, true);
    toLogin();
    throw new Error('인증이 필요합니다.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `요청 실패 (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// 인증을 붙여 바이너리(blob)를 받아 파일 다운로드를 트리거한다.
export async function apiDownload(path: string, filename: string, retried = false): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (res.status === 401) {
    if (!retried && (await tryRefresh())) return apiDownload(path, filename, true);
    toLogin();
    throw new Error('인증이 필요합니다.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `요청 실패 (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// 로그아웃 — 서버 refresh 쿠키 제거 + 로컬 access 토큰 제거
export async function apiLogout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    // 네트워크 실패해도 로컬 토큰은 제거
  }
  if (typeof window !== 'undefined') localStorage.removeItem('auth_token');
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  upload: <T>(path: string, file: File, field?: string) => apiUpload<T>(path, file, field),
  download: (path: string, filename: string) => apiDownload(path, filename),
  logout: () => apiLogout(),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'DELETE', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }),
};
