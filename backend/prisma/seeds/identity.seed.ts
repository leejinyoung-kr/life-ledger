/**
 * 신원 지갑 더미 — 문서 번호 AES 암호화. 만료 임박(여권) 포함해 알림/D-day 데모.
 * CREDENTIAL_SECRET 미설정 시 건너뜀(암호화 불가).
 */
import type { IdentityType } from '@prisma/client';
import { canEncrypt, d, daysAgo, enc, type SeedFn } from './helpers';

// 만료일은 오늘 기준 상대 계산 (여권은 D-45 임박)
const inDays = (n: number): Date => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

type IdSeed = { type: IdentityType; name: string; number: string; issueDate: Date | null; expireDate: Date | null };

const IDS: IdSeed[] = [
  { type: 'passport', name: '여권', number: 'M12345678', issueDate: daysAgo(1500), expireDate: inDays(45) },
  { type: 'idcard', name: '주민등록증', number: '900101-1234567', issueDate: d('2009-03-10'), expireDate: null },
  { type: 'license', name: '운전면허', number: '11-22-334455-66', issueDate: d('2018-06-20'), expireDate: inDays(400) },
];

// 한 사용자에게 신원 문서 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedIdentity: SeedFn = async (prisma, userId) => {
  if (!canEncrypt()) {
    console.warn('  ⚠️ CREDENTIAL_SECRET 미설정 — 신원 더미 건너뜀');
    return 0;
  }
  await prisma.identityCard.deleteMany({ where: { user_id: userId } });

  for (const i of IDS) {
    await prisma.identityCard.create({
      data: {
        user_id: userId,
        type: i.type,
        name: i.name,
        number_enc: enc(i.number),
        issue_date: i.issueDate,
        expire_date: i.expireDate,
      },
    });
  }

  return IDS.length;
};
