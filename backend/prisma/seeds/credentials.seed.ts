/**
 * 계정 보관함 더미 — 비밀번호/TOTP/백업코드 AES 암호화.
 * 실시간 보안 분석(재사용·취약·2FA미설정)·비번 회전 알림(90일+)·2FA 백업코드 데모가 모두 동작하도록 구성.
 * CREDENTIAL_SECRET 미설정 시 건너뜀(암호화 불가).
 */
import { canEncrypt, daysAgo, enc, type SeedFn } from './helpers';

type CredSeed = {
  name: string;
  url: string | null;
  category: string;
  username: string;
  password: string;
  totp?: string; // 2FA 시크릿
  backupCodes?: string[]; // 2FA 백업코드
  pwChangedDaysAgo: number; // 비번 마지막 변경 시점(일 전)
};

// 재사용(Passw0rd! 3건)·취약(bank123)·강함+2FA·일부 90일 경과로 구성
const CREDS: CredSeed[] = [
  { name: 'GitHub', url: 'https://github.com', category: '개발', username: 'devuser', password: 'Passw0rd!', pwChangedDaysAgo: 120 },
  { name: '쿠팡', url: 'https://coupang.com', category: '쇼핑', username: 'shopper@example.com', password: 'Passw0rd!', pwChangedDaysAgo: 40 },
  { name: '넷플릭스', url: 'https://netflix.com', category: '구독', username: 'watcher@example.com', password: 'Passw0rd!', pwChangedDaysAgo: 200 },
  { name: '카카오뱅크', url: 'https://kakaobank.com', category: '금융', username: 'mybank', password: 'bank123', pwChangedDaysAgo: 95 },
  {
    name: 'Google', url: 'https://google.com', category: '소셜', username: 'me@gmail.com',
    password: 'Tr0ub4dour&3xpl0it', totp: 'JBSWY3DPEHPK3PXP',
    backupCodes: ['A1B2-C3D4', 'E5F6-7890', '1122-3344', '5566-7788', '99AA-BBCC'],
    pwChangedDaysAgo: 10,
  },
  { name: 'AWS', url: 'https://aws.amazon.com', category: '개발', username: 'iam-admin', password: 'Aws$ecure2026!', totp: 'KRSXG5CTMVRXEZLU', pwChangedDaysAgo: 30 },
];

// 한 사용자에게 계정 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedCredentials: SeedFn = async (prisma, userId) => {
  if (!canEncrypt()) {
    console.warn('  ⚠️ CREDENTIAL_SECRET 미설정 — 계정 더미 건너뜀');
    return 0;
  }
  await prisma.credential.deleteMany({ where: { user_id: userId } });

  for (const c of CREDS) {
    await prisma.credential.create({
      data: {
        user_id: userId,
        name: c.name,
        url: c.url,
        category: c.category,
        username: c.username,
        password_enc: enc(c.password),
        totp_enc: c.totp ? enc(c.totp) : null,
        backup_codes_enc: c.backupCodes ? enc(JSON.stringify(c.backupCodes)) : null,
        password_changed_at: daysAgo(c.pwChangedDaysAgo),
      },
    });
  }

  return CREDS.length;
};
