import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/**
 * 민감 자격증명(계정 비밀번호·신원 번호·ENV 값) AES-256-GCM 암복호화.
 * 키는 CREDENTIAL_SECRET 을 sha256 으로 32바이트화하여 사용(길이 무관 입력 허용).
 * 저장 포맷: `v1:ivHex:tagHex:cipherHex` (복호화 시 버전/구분자로 파싱).
 */
@Injectable()
export class CryptoService {
  private cachedKey: Buffer | null = null;
  private static readonly PREFIX = 'v1';

  // 키 지연 평가 — 미설정 시 앱 부팅을 막지 않고, 보관함 사용 시점에만 검증
  private get key(): Buffer {
    if (this.cachedKey) return this.cachedKey;
    const secret = process.env.CREDENTIAL_SECRET;
    if (!secret) {
      throw new InternalServerErrorException(
        'CREDENTIAL_SECRET 환경변수가 설정되지 않았습니다.',
      );
    }
    // 임의 길이 시크릿 → 고정 32바이트 키 (AES-256)
    this.cachedKey = createHash('sha256').update(secret).digest();
    return this.cachedKey;
  }

  // 평문을 AES-256-GCM 으로 암호화해 저장 문자열로 직렬화
  encrypt(plain: string): string {
    const iv = randomBytes(12); // GCM 권장 96bit
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${CryptoService.PREFIX}:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
  }

  // 저장 문자열을 복호화. 포맷 불일치/변조 시 예외
  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 4 || parts[0] !== CryptoService.PREFIX) {
      throw new InternalServerErrorException('암호문 형식이 올바르지 않습니다.');
    }
    const [, ivHex, tagHex, cipherHex] = parts;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(cipherHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  // 빈 값/undefined 는 그대로(null) 두고, 값이 있으면 암호화
  encryptNullable(plain: string | null | undefined): string | null {
    return plain ? this.encrypt(plain) : null;
  }
}
