import { createCipheriv, createHash, randomBytes } from 'crypto';

// core-security 0.1.x(v1) 포맷 암호문 — sha256(secret) 키, AAD 없음.
// 재암호화 이전의 DB 행·예전에 내보낸 백업 파일을 흉내 낼 때 쓴다
export function v1Encrypt(plain: string, secret: string): string {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${body.toString('hex')}`;
}
