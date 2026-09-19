import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';

// 외부 연결에서 주소 하나당 기다리는 시간(ms).
// Node 22 기본값 250ms 는 홈서버→B2(eu-central) 왕복 약 260ms 보다 짧다 — 주소 4개를 250ms 씩 시도하다 전부 끊겨
// 파일 업로드가 ETIMEDOUT(500)으로 실패했다. 2026-09-19 실측: 기본값 1014ms 실패 / 자동선택 끔 260ms 성공
export const CONNECT_ATTEMPT_TIMEOUT_MS = 2000;

// 부팅 시 한 번 — 이후 net/tls 연결(B2 업로드·삭제를 하는 AWS SDK, 웹 푸시 등)의 기본값이 된다
export function configureOutboundNetwork(): void {
  setDefaultAutoSelectFamilyAttemptTimeout(CONNECT_ATTEMPT_TIMEOUT_MS);
}
