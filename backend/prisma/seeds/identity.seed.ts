/**
 * 신원 지갑 더미 — 문서 번호 AES 암호화. 만료 임박(여권) 포함해 알림/D-day 데모.
 * 앱과 같은 키링(backend/.env 의 CRYPTO_KEYS)·문맥으로 암호화.
 */
import type { IdentityType } from '@prisma/client';
import { d, daysAgo, enc, type SeedFn } from './helpers';

// 만료일은 오늘 기준 상대 계산 (여권은 D-45 임박)
const inDays = (n: number): Date => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

type IdSeed = { type: IdentityType; name: string; number: string; issueDate: Date | null; expireDate: Date | null };

const IDS: IdSeed[] = [
  { type: 'passport', name: '여권', number: 'M12345678', issueDate: daysAgo(1500), expireDate: inDays(45) },
  { type: 'idcard', name: '주민등록증', number: '900101-1234567', issueDate: d('2009-03-10'), expireDate: null },
  { type: 'license', name: '운전면허', number: '11-22-334455-66', issueDate: d('2018-06-20'), expireDate: inDays(400) },
  { type: 'cert', name: '정보처리기사', number: '21202010-1234A', issueDate: d('2021-08-20'), expireDate: null },
  { type: 'cert', name: 'SQLD', number: 'SQLD-045-012345', issueDate: d('2023-04-15'), expireDate: null },
  { type: 'etc', name: '사원증', number: 'EMP-2020-0817', issueDate: d('2020-08-17'), expireDate: null },
  { type: 'etc', name: '건강보험증', number: '1-2345678901', issueDate: d('2020-01-02'), expireDate: null },
];

// 한 사용자에게 신원 문서 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedIdentity: SeedFn = async (prisma, userId) => {
  await prisma.identityCard.deleteMany({ where: { user_id: userId } });

  for (const i of IDS) {
    await prisma.identityCard.create({
      data: {
        user_id: userId,
        type: i.type,
        name: i.name,
        number_enc: enc(i.number, 'identityCard.number_enc', userId),
        issue_date: i.issueDate,
        expire_date: i.expireDate,
      },
    });
  }

  return IDS.length;
};
