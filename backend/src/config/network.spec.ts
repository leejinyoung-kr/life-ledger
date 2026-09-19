import {
  getDefaultAutoSelectFamilyAttemptTimeout,
  setDefaultAutoSelectFamilyAttemptTimeout,
} from 'node:net';
import {
  CONNECT_ATTEMPT_TIMEOUT_MS,
  configureOutboundNetwork,
} from './network';

// 홈서버→B2 왕복(약 260ms)보다 짧은 Node 기본값(250ms)으로 되돌아가면 업로드가 다시 ETIMEDOUT 으로 실패한다
describe('configureOutboundNetwork', () => {
  const original = getDefaultAutoSelectFamilyAttemptTimeout();
  afterAll(() => setDefaultAutoSelectFamilyAttemptTimeout(original));

  it('주소당 연결 대기 시간을 B2 왕복보다 넉넉하게 올린다', () => {
    configureOutboundNetwork();
    expect(getDefaultAutoSelectFamilyAttemptTimeout()).toBe(
      CONNECT_ATTEMPT_TIMEOUT_MS,
    );
    expect(CONNECT_ATTEMPT_TIMEOUT_MS).toBeGreaterThanOrEqual(1000);
  });
});
