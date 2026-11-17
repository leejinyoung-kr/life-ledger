import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 세션 복구(ensureSession → tryRefresh)의 재시도 규칙 — 응답이 끊기거나(네트워크 오류 · 5xx) 동시 갱신에 지면(401) 한 번만 다시 시도한다.
// 테스트 환경은 node 라 window · document 를 흉내 내고, 모듈 안 토큰 상태를 비우려고 매번 새로 불러온다
const ok = (token: string) => ({ ok: true, status: 200, json: () => Promise.resolve({ token }) });
const fail = (status: number) => ({ ok: false, status, json: () => Promise.resolve(null) });

// fetch 응답을 차례대로 돌려주는 가짜 — Error 면 네트워크 오류처럼 reject
function mockFetch(...steps: unknown[]) {
  const fn = vi.fn();
  for (const s of steps) {
    if (s instanceof Error) fn.mockRejectedValueOnce(s);
    else fn.mockResolvedValueOnce(s);
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

// 타이머를 빨리 감아 재시도 대기를 넘긴 뒤 결과를 받는다
async function run(p: Promise<boolean>): Promise<boolean> {
  await vi.runAllTimersAsync();
  return p;
}

describe('ensureSession 재시도', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal('window', { location: { href: '' } });
    vi.stubGlobal('document', { cookie: 'll_has_session=1' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('네트워크 오류 뒤 다시 시도해 성공하면 true', async () => {
    const fetchFn = mockFetch(new TypeError('Failed to fetch'), ok('a'));
    const { ensureSession } = await import('../../lib/api');
    expect(await run(ensureSession())).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('게이트웨이 오류(504) 뒤 다시 시도', async () => {
    const fetchFn = mockFetch(fail(504), ok('a'));
    const { ensureSession } = await import('../../lib/api');
    expect(await run(ensureSession())).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('401 뒤 다시 시도 — 두 번째도 실패하면 false, 세 번은 부르지 않는다', async () => {
    const fetchFn = mockFetch(fail(401), fail(401));
    const { ensureSession } = await import('../../lib/api');
    expect(await run(ensureSession())).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('400 같은 다른 오류는 다시 시도하지 않는다', async () => {
    const fetchFn = mockFetch(fail(400));
    const { ensureSession } = await import('../../lib/api');
    expect(await run(ensureSession())).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('세션 힌트 쿠키가 없으면 refresh 를 부르지 않는다', async () => {
    vi.stubGlobal('document', { cookie: '' });
    const fetchFn = mockFetch();
    const { ensureSession } = await import('../../lib/api');
    expect(await run(ensureSession())).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
