/**
 * 데모 인스턴스 매일 초기화 — 방문자가 바꾼 데이터를 지우고 샘플 데이터를 다시 넣는다.
 *
 * 순서: DEMO_MODE 확인 → 앱 데이터 비우기 → 시드(prisma/seed.ts) → 데모 사용자에 마스터 잠금 다시 걸기
 * 실행: pnpm demo:reset  (홈서버 데모 컨테이너에서 매일 새벽 cron 으로)
 *
 * **DEMO_MODE=true 가 아니면 아무것도 지우지 않고 끝낸다** — 운영 DB 에서 잘못 돌려도 안전하도록.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { withKstDateTime } from '@leejinyoung-kr/core-db';
import 'dotenv/config';

// src/common/demo.ts 와 같은 값 — src/common/demo.ts 는 env 검증까지 끌고 와서 여기서는 import 하지 않는다.
// 데모 사용자 이메일 · 마스터 잠금 비밀번호(화면의 데모 띠에 보이는 값이라 비밀이 아니다)
const DEMO_EMAIL = 'demo@life-ledger.local';
const DEMO_VAULT_PASSWORD = 'demo1234';

// 비우지 않는 테이블 — 마이그레이션 이력 · 공휴일 캐시(전 사용자 공용) · 예약 작업 실행 기록(운영 확인용)
const KEEP = new Set(['_prisma_migrations', 'holiday', 'job_run']);

// 마스터 비번 → scrypt 해시(saltHex:hashHex) — VaultService.hash 와 같은 형식
function hashVaultPassword(pw: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(pw, salt, 32).toString('hex')}`;
}

async function main() {
  if (process.env.DEMO_MODE !== 'true') {
    console.error('DEMO_MODE=true 가 아니라 초기화하지 않습니다 (운영 DB 보호).');
    process.exit(1);
  }

  // 시각 컬럼은 KST 벽시계로 쓴다 (infra ADR 0008) — 앱과 같은 감싸기
  const prisma = new PrismaClient({ adapter: withKstDateTime(new PrismaMariaDb(process.env.DATABASE_URL!)) });
  try {
    const tables = await prisma.$queryRaw<{ name: string }[]>`
      SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`;
    const targets = tables.map((t) => t.name).filter((n) => !KEEP.has(n));

    // 외래 키 순서를 따지지 않도록 한 연결 안에서 FK 검사를 끄고 지운다
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
      for (const name of targets) await tx.$executeRawUnsafe(`DELETE FROM \`${name.replace(/`/g, '')}\``);
      await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
    }, { timeout: 60_000 });
    console.log(`비운 테이블 ${targets.length}개`);

    // 시드 — 사용자가 없으니 데모 사용자(DEMO_EMAIL)를 만들고 오늘 기준 날짜로 샘플을 넣는다
    execFileSync(process.execPath, [require.resolve('tsx/cli'), 'prisma/seed.ts'], { stdio: 'inherit' });

    // 데모에서도 잠금 흐름을 볼 수 있게 마스터 잠금을 켜 둔다(비밀번호는 화면의 데모 띠에 보인다)
    const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (!user) throw new Error(`데모 사용자(${DEMO_EMAIL})가 시드 후에도 없습니다.`);
    await prisma.userSettings.update({
      where: { user_id: user.id },
      data: { master_lock_enabled: true, master_lock_hash: hashVaultPassword(DEMO_VAULT_PASSWORD), master_lock_timeout: 5 },
    });
    console.log('데모 초기화 완료');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
