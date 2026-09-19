import type { CryptoModuleOptions } from '@leejinyoun/core-security';
import { env } from '../config/env';

// 환경변수 → CryptoModule 옵션. CRYPTO_KEYS 의 첫 번째 키로 암호화하고 나머지는 복호화만 한다.
// CREDENTIAL_SECRET 은 v1(이전 포맷) 암호문을 읽을 때만 쓴다 — 재암호화가 끝나면 비운다
export function cryptoOptions(): CryptoModuleOptions {
  return {
    keys: env.CRYPTO_KEYS,
    currentKeyId: env.CRYPTO_KEYS[0].id,
    legacySecret: env.CREDENTIAL_SECRET,
  };
}
