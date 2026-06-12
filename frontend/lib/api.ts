/**
 * 백엔드 API fetch 래퍼.
 * access 토큰은 XSS 위험을 줄이기 위해 localStorage 가 아닌 메모리(모듈 변수)에만 보관한다.
 * access 만료(401) 시 httpOnly refresh 쿠키로 /auth/refresh 를 1회 시도해 토큰을 갱신하고 재요청한다.
 * 갱신도 실패하면 토큰 제거 후 로그인 페이지로 보낸다.
 */

import { getVaultToken, requestVaultUnlock } from './vault';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

// 메모리에 보관 중인 access 토큰 (새로고침 시 사라짐 — ensureSession 으로 복구)
let accessToken: string | null = null;

// access 토큰 반환
function getToken(): string | null {
  return accessToken;
}

// access 토큰 갱신/제거 — 로그인 콜백, 로그아웃, refresh 성공 시 호출
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// 토큰 제거 후 로그인으로 이동
function toLogin(): void {
  setAccessToken(null);
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

// 동시 다발 401 에서 refresh 가 중복 호출되지 않도록 진행 중 Promise 를 공유
let refreshing: Promise<boolean> | null = null;

// refresh 쿠키로 새 access 발급 시도 — 성공 시 메모리 토큰 갱신
function tryRefresh(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (!refreshing) {
    refreshing = fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return false;
        const body = (await res.json().catch(() => null)) as { token?: string } | null;
        if (!body?.token) return false;
        setAccessToken(body.token);
        return true;
      })
      .catch(() => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

// 새로고침/최초 진입 시 세션 복구 — httpOnly refresh 쿠키로 access 재발급 시도
export async function ensureSession(): Promise<boolean> {
  if (accessToken) return true;
  return tryRefresh();
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

// multipart 파일 업로드 후 바이너리(blob) 응답을 받아 파일 다운로드를 트리거한다 (변환 등 stateless 처리용)
export async function apiUploadDownload(
  path: string,
  file: File,
  filename: string,
  field = 'file',
  retried = false,
): Promise<void> {
  const token = getToken();
  const form = new FormData();
  form.append(field, file);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });

  if (res.status === 401) {
    if (!retried && (await tryRefresh())) return apiUploadDownload(path, file, filename, field, true);
    toLogin();
    throw new Error('인증이 필요합니다.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `요청 실패 (${res.status})`);
  }

  // 서버가 Content-Disposition 으로 실제 결과 파일명(확장자 포함)을 주면 그것을 우선 — 멀티페이지 ZIP 등 결과 형식을 미리 알 수 없는 경우 대비
  const serverName = parseContentDispositionFilename(res.headers.get('content-disposition'));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = serverName ?? filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Content-Disposition 헤더에서 filename*=UTF-8''... (RFC 5987) 또는 filename="..." 추출
function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      // 디코딩 실패 시 plain filename 으로 폴백
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain ? plain[1] : null;
}

// 로그아웃 — 서버 refresh 쿠키 제거 + 메모리 access 토큰 제거
export async function apiLogout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    // 네트워크 실패해도 메모리 토큰은 제거
  }
  setAccessToken(null);
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  upload: <T>(path: string, file: File, field?: string) => apiUpload<T>(path, file, field),
  download: (path: string, filename: string) => apiDownload(path, filename),
  uploadDownload: (path: string, file: File, filename: string, field?: string) =>
    apiUploadDownload(path, file, filename, field),
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
