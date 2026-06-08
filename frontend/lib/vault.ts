/**
 * 마스터 잠금(보관함 2차 잠금) 클라이언트 상태.
 * 잠금 해제 토큰은 메모리에만 보관(새로고침 시 재잠금) — reveal 류 요청에 x-vault-token 으로 첨부된다.
 * 423(VAULT_LOCKED) 응답 시 api 래퍼가 등록된 잠금해제 핸들러(모달)를 호출해 토큰을 갱신한다.
 */

let vaultToken: string | null = null;
let vaultExpiry = 0; // epoch ms

// 유효한 잠금해제 토큰 반환 (만료 시 null)
export function getVaultToken(): string | null {
  if (vaultToken && Date.now() < vaultExpiry) return vaultToken;
  vaultToken = null;
  return null;
}

// 잠금 해제 성공 시 토큰 저장 (만료 5초 전까지만 유효 처리)
export function setVaultToken(token: string, expiresInSec: number): void {
  vaultToken = token;
  vaultExpiry = Date.now() + expiresInSec * 1000 - 5000;
}

// 토큰 폐기(수동 잠금)
export function clearVaultToken(): void {
  vaultToken = null;
  vaultExpiry = 0;
}

// 잠금해제 모달이 등록하는 핸들러 — 비번 입력 → 토큰 발급 성공 시 true
type UnlockFn = () => Promise<boolean>;
let unlockHandler: UnlockFn | null = null;

export function registerVaultUnlock(fn: UnlockFn | null): void {
  unlockHandler = fn;
}

// api 래퍼가 423 시 호출 — 핸들러 없으면 즉시 실패
export function requestVaultUnlock(): Promise<boolean> {
  if (!unlockHandler) return Promise.resolve(false);
  return unlockHandler();
}
