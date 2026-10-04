import { Inject, Injectable } from '@nestjs/common';
import { CryptoService, readCipherHeader } from '@leejinyoung-kr/core-security';
import { CIPHER_STORE, type CipherRow, type CipherStore } from './cipher-store';
import {
  cipherContext,
  ENCRYPTED_COLUMNS,
  type EncryptedColumn,
} from './crypto-fields';

// missing-key: 설정에 없는 키(키를 너무 일찍 뺌) · invalid: 암호문 형식 아님(손상) · decrypt: 키는 있으나 인증 실패(시크릿·문맥 불일치, 변조)
export type CipherFailureKind = 'missing-key' | 'invalid' | 'decrypt';

export interface CipherFailure {
  id: number;
  key: string; // 머리의 키('v1' | '<키ID>' | '형식 오류') — 한 키가 통째로 실패하는지 보려고
  kind: CipherFailureKind;
  reason: string;
}

// 컬럼 하나의 암호문 상태 — 값은 담지 않는다
export interface ColumnReport {
  label: string; // table.column
  total: number;
  byKey: Record<string, number>; // 'v1' | '<키ID>' | '평문'
  stale: number; // 재암호화 대상(v1·이전 키·평문)
  failures: CipherFailure[];
}

export interface ReencryptResult {
  label: string;
  converted: number;
  conflicts: number; // 읽은 뒤 사용자가 값을 바꿔 건너뜀 — 다음 부팅 때 다시 대상이 된다
  failures: CipherFailure[];
}

const PLAINTEXT = '평문';

// 행 하나의 머리 판정 결과
interface Classified {
  key: string;
  stale: boolean;
  failure?: CipherFailure;
}

// 암호화 컬럼 전체를 점검·재암호화한다. 어느 테이블을 도는지는 ENCRYPTED_COLUMNS 가 정한다
@Injectable()
export class CryptoAuditService {
  constructor(
    @Inject(CIPHER_STORE) private readonly store: CipherStore,
    private readonly crypto: CryptoService,
  ) {}

  // 전부 실제로 복호화해 본다 — 머리(키 ID)만 봐서는 시크릿을 잘못 넣은 경우를 못 잡는다(부팅·배포 전 점검 공용)
  async verify(): Promise<ColumnReport[]> {
    const reports: ColumnReport[] = [];
    for (const col of ENCRYPTED_COLUMNS) {
      const rows = await this.store.load(col);
      const report: ColumnReport = {
        label: labelOf(col),
        total: rows.length,
        byKey: {},
        stale: 0,
        failures: [],
      };
      for (const row of rows) {
        const c = this.classify(col, row);
        report.byKey[c.key] = (report.byKey[c.key] ?? 0) + 1;
        if (c.failure) {
          report.failures.push(c.failure);
          continue;
        }
        if (c.key !== PLAINTEXT) {
          try {
            this.crypto.decrypt(
              row.value,
              cipherContext(col.field, row.userId),
            );
          } catch (e) {
            report.failures.push({
              id: row.id,
              key: c.key,
              kind: 'decrypt',
              reason: messageOf(e),
            });
            continue;
          }
        }
        if (c.stale) report.stale++;
      }
      reports.push(report);
    }
    return reports;
  }

  // 현재 키가 아닌 암호문(v1·이전 키)과 평문 레거시를 현재 키로 다시 암호화한다
  async reencrypt(): Promise<ReencryptResult[]> {
    const results: ReencryptResult[] = [];
    for (const col of ENCRYPTED_COLUMNS) {
      const result: ReencryptResult = {
        label: labelOf(col),
        converted: 0,
        conflicts: 0,
        failures: [],
      };
      for (const row of await this.store.load(col)) {
        const c = this.classify(col, row);
        if (c.failure || !c.stale) continue;
        const context = cipherContext(col.field, row.userId);
        let next: string;
        try {
          next =
            c.key === PLAINTEXT
              ? this.seal(row.value, context)
              : this.crypto.reencrypt(row.value, context);
        } catch (e) {
          result.failures.push({
            id: row.id,
            key: c.key,
            kind: 'decrypt',
            reason: messageOf(e),
          });
          continue;
        }
        if (await this.store.replace(col, row.id, row.value, next))
          result.converted++;
        else result.conflicts++;
      }
      results.push(result);
    }
    return results;
  }

  // 머리만 보고 어느 키인지·재암호화 대상인지·지금 설정으로 읽을 수 있는지 판정
  private classify(col: EncryptedColumn, row: CipherRow): Classified {
    const header = readCipherHeader(row.value);
    if (!header) {
      if ('legacyPlaintext' in col) return { key: PLAINTEXT, stale: true };
      return {
        key: '형식 오류',
        stale: false,
        failure: {
          id: row.id,
          key: '형식 오류',
          kind: 'invalid',
          reason: '암호문 형식이 아님',
        },
      };
    }
    const key = header.version === 1 ? 'v1' : header.keyId;
    if (!this.crypto.hasKeyFor(row.value)) {
      const reason =
        header.version === 1
          ? 'v1 암호문인데 CREDENTIAL_SECRET 이 없음'
          : `키 ${key} 가 CRYPTO_KEYS 에 없음`;
      return {
        key,
        stale: false,
        failure: { id: row.id, key, kind: 'missing-key', reason },
      };
    }
    return { key, stale: this.crypto.needsReencrypt(row.value) };
  }

  // 평문 레거시를 암호화하고, 되풀어 원문과 같은지 확인한다
  private seal(plain: string, context: string): string {
    const next = this.crypto.encrypt(plain, context);
    if (this.crypto.decrypt(next, context) !== plain)
      throw new Error('암호화 검증 실패');
    return next;
  }
}

// 로그·점검 출력용 이름 (table.column)
function labelOf(col: EncryptedColumn): string {
  return `${col.table}.${col.column}`;
}

// 예외 메시지만 — core-security 는 값·시크릿을 메시지에 넣지 않는다
function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// 점검 결과를 사람이 읽을 표로 — 컬럼별 건수·키 분포·실패 위치(table.column#id). 값은 출력하지 않는다
export function formatReports(reports: ColumnReport[]): string {
  const width = Math.max(...reports.map((r) => r.label.length));
  const lines = reports.map((r) => {
    const keys = Object.entries(r.byKey)
      .map(([k, n]) => `${k} ${n}`)
      .join(' · ');
    return `  ${r.label.padEnd(width)}  ${String(r.total).padStart(4)}건  ${keys || '-'}`;
  });
  for (const r of reports) {
    for (const f of r.failures)
      lines.push(`  ✗ ${r.label}#${f.id} [${f.kind}] ${f.reason}`);
  }
  return lines.join('\n');
}

// 암호문이 하나도 복호화되지 않은 키 — 일부 행만 실패하면 데이터 문제지만, 전부 실패하면 시크릿 값이 틀린 것이다
export function brokenKeys(reports: ColumnReport[]): string[] {
  const total = new Map<string, number>();
  const failed = new Map<string, number>();
  for (const r of reports) {
    for (const [key, n] of Object.entries(r.byKey))
      total.set(key, (total.get(key) ?? 0) + n);
    for (const f of r.failures) {
      if (f.kind === 'decrypt') failed.set(f.key, (failed.get(f.key) ?? 0) + 1);
    }
  }
  return [...failed]
    .filter(([key, n]) => n === total.get(key))
    .map(([key]) => key);
}
