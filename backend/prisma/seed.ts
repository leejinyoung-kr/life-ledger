/**
 * 더미 데이터 시드 — 오케스트레이터.
 *
 * 도메인별 시드는 prisma/seeds/*.seed.ts 에 분리돼 있고, 여기서는 호출만 한다.
 * 새 더미 추가 시: seeds/ 에 파일 만들고 아래 SEEDS 배열에 한 줄 등록.
 *
 * 동작: user 전체(없으면 데모 1명 생성)에 대해 각 시드 함수를 순서대로 실행.
 *       각 시드는 자기 도메인 행을 지우고 다시 넣어 idempotent 하다.
 *
 * 실행: npx prisma db seed  (또는 npx tsx prisma/seed.ts)
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';
import type { SeedFn } from './seeds/helpers';
import { seedTransactions } from './seeds/transactions.seed';
import { seedSavings } from './seeds/savings.seed';
import { seedInvestments } from './seeds/investments.seed';
import { seedSubscriptions } from './seeds/subscriptions.seed';
import { seedNetWorthSnapshots } from './seeds/net-worth-snapshot.seed';
import { seedSettings } from './seeds/settings.seed';
import { seedNotifications } from './seeds/notifications.seed';
import { seedSecurity } from './seeds/security.seed';
import { seedCategories } from './seeds/categories.seed';
import { seedCredentials } from './seeds/credentials.seed';
import { seedSystemLogs } from './seeds/system-log.seed';

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

// 등록된 도메인 시드 (실행 순서 = 배열 순서). 도메인 늘면 여기에 추가.
// 예적금/투자는 수입/지출보다 먼저 — 자산이동(transfer) 거래가 대상(target) 행을 이름으로 조회해 연동하므로 순서 필요
const SEEDS: { name: string; run: SeedFn }[] = [
  { name: '예적금', run: seedSavings },
  { name: '투자', run: seedInvestments },
  { name: '순자산 스냅샷', run: seedNetWorthSnapshots },
  { name: '수입/지출', run: seedTransactions },
  { name: '구독', run: seedSubscriptions },
  { name: '설정', run: seedSettings },
  { name: '알림', run: seedNotifications },
  { name: '계정보관함', run: seedCredentials },
  { name: '보안센터', run: seedSecurity },
  { name: '카테고리', run: seedCategories },
  { name: '시스템 로그', run: seedSystemLogs },
];

// user 가 한 명도 없으면 데모 계정 생성 (로그인 전에도 시드 가능하도록)
async function ensureUsers() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  if (users.length > 0) return users;
  const demo = await prisma.user.create({
    data: { google_id: 'demo-google-id', email: 'demo@docnexus.local', name: '데모 사용자' },
    select: { id: true, email: true },
  });
  console.log(`데모 사용자 생성: ${demo.email} (#${demo.id})`);
  return [demo];
}

async function main() {
  const users = await ensureUsers();
  console.log(`시드 대상 사용자 ${users.length}명 · 도메인 ${SEEDS.length}종`);

  for (const u of users) {
    // 순차 실행 — 수입/지출 시드가 예적금/투자/자산종합 행을 이름으로 조회해 연동하므로 배열 순서가 곧 의존 순서
    const counts: number[] = [];
    for (const s of SEEDS) {
      counts.push(await s.run(prisma, u.id));
    }
    const detail = SEEDS.map((s, i) => `${s.name} ${counts[i]}`).join(' · ');
    console.log(`  ✓ user#${u.id}: ${detail}`);
  }
  console.log('완료.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
