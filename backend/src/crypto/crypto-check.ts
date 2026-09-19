// 배포 전 점검(node dist/crypto/crypto-check) — 새 이미지의 키 설정으로 DB 의 암호문을 전부 실제로 복호화해 본다.
// 이전 키를 너무 일찍 뺐거나 시크릿을 잘못 넣었으면 exit 1 → 배포 워크플로가 컨테이너를 교체하기 전에 멈춘다.
// 읽기만 한다(재암호화는 새 컨테이너가 부팅하며 한다 — 기존 컨테이너는 새 포맷을 못 읽을 수 있어서). 값은 출력하지 않는다
import { CryptoService } from '@leejinyoun/core-security';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaCipherStore } from './cipher-store';
import { CryptoAuditService, formatReports } from './crypto-audit.service';
import { cryptoOptions } from './crypto-options';

// 키 설정 검증 → 전체 복호화 점검 → 요약 출력. 실패가 있으면 exit code 1
async function main(): Promise<void> {
  const crypto = new CryptoService(cryptoOptions());
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const reports = await new CryptoAuditService(
      new PrismaCipherStore(prisma),
      crypto,
    ).verify();
    const { currentKeyId, keyIds, legacy } = crypto.status();
    console.log(
      `암호화 키: 현재 ${currentKeyId} · 복호화 가능 ${keyIds.join(', ')}${legacy ? ' + v1(CREDENTIAL_SECRET)' : ''}`,
    );
    console.log(formatReports(reports));
    const total = reports.reduce((n, r) => n + r.total, 0);
    const failures = reports.reduce((n, r) => n + r.failures.length, 0);
    const stale = reports.reduce((n, r) => n + r.stale, 0);
    if (failures) {
      console.error(
        `암호문 점검 실패 — ${failures}건을 지금 설정으로 복호화할 수 없음`,
      );
      process.exitCode = 1;
      return;
    }
    console.log(
      `암호문 점검 통과 — ${total}건 전부 복호화됨 (현재 키가 아닌 ${stale}건은 부팅 시 재암호화)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
