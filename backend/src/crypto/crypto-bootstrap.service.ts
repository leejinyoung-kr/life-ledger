import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { CryptoService } from '@leejinyoun/core-security';
import {
  brokenKeys,
  CryptoAuditService,
  formatReports,
} from './crypto-audit.service';

// 부팅 시 암호문 점검 + 자동 재암호화. 키 교체는 곧 재시작이므로 크론 대신 부팅에서 한 번 돈다.
// listen 전에 끝나므로 요청은 항상 재암호화 이후 상태를 본다
@Injectable()
export class CryptoBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Crypto');

  constructor(
    private readonly crypto: CryptoService,
    private readonly audit: CryptoAuditService,
  ) {}

  // 전부 복호화해 보고, 설정 문제면 부팅을 멈춘다 — ① 설정에 없는 키로 된 암호문(키를 너무 일찍 뺌)
  // ② 한 키로 된 암호문이 하나도 안 풀림(시크릿 값이 틀림). 일부 행만 실패하면 데이터 문제라 로그만 남기고 계속한다
  async onApplicationBootstrap(): Promise<void> {
    const { currentKeyId, keyIds, legacy } = this.crypto.status();
    this.logger.log(
      `암호화 키: 현재 ${currentKeyId} · 복호화 가능 ${keyIds.join(', ')}${legacy ? ' + v1(CREDENTIAL_SECRET)' : ''}`,
    );

    const reports = await this.audit.verify();
    const missing = reports.flatMap((r) =>
      r.failures.filter((f) => f.kind === 'missing-key'),
    );
    if (missing.length) {
      throw new Error(
        [
          `설정에 없는 키로 된 암호문 ${missing.length}건 — 이전 키를 CRYPTO_KEYS(또는 v1 이면 CREDENTIAL_SECRET)에 다시 넣고 재시작하면 현재 키로 재암호화된다`,
          formatReports(reports),
        ].join('\n'),
      );
    }
    const broken = brokenKeys(reports);
    if (broken.length) {
      throw new Error(
        [
          `키 ${broken.join(', ')} 로 된 암호문이 하나도 복호화되지 않음 — 시크릿 값이 틀렸다(CRYPTO_KEYS${broken.includes('v1') ? '·CREDENTIAL_SECRET' : ''} 확인)`,
          formatReports(reports),
        ].join('\n'),
      );
    }
    const bad = reports.flatMap((r) =>
      r.failures.map((f) => `${r.label}#${f.id} [${f.kind}] ${f.reason}`),
    );
    if (bad.length)
      this.logger.error(
        `복호화할 수 없는 암호문 ${bad.length}건 (재암호화 제외, 해당 항목 열람 시 오류):\n  ${bad.join('\n  ')}`,
      );

    const total = reports.reduce((n, r) => n + r.total, 0);
    const stale = reports.reduce((n, r) => n + r.stale, 0);
    if (stale === 0) {
      this.logger.log(
        `암호문 ${total}건 점검 — 재암호화 대상 없음 (현재 키 ${currentKeyId})`,
      );
      return;
    }
    const results = await this.audit.reencrypt();
    const converted = results.reduce((n, r) => n + r.converted, 0);
    const conflicts = results.reduce((n, r) => n + r.conflicts, 0);
    this.logger.log(
      `암호문 ${total}건 점검 — 재암호화 ${converted}/${stale}건 → ${currentKeyId}${conflicts ? ` (동시 수정으로 건너뜀 ${conflicts}건 — 다음 부팅 때 다시 시도)` : ''}`,
    );
  }
}
