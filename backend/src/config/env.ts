import { csv, defineEnv, z } from '@leejinyoun/core-config';

// .env.example 의 예시 기본값 — 그대로 운영에 올라가는 것을 막는다
const PLACEHOLDERS = new Set([
  'your_super_secret_jwt_key_change_this',
  'your_refresh_jwt_secret_change_this',
  'your_vault_jwt_secret_change_this',
  'change_this_to_a_long_random_secret',
]);

// 서명·암호화 키 — 32자 이상 + 예시 기본값 거부
const secret = () =>
  z
    .string()
    .min(32)
    .refine(
      (v) => !PLACEHOLDERS.has(v),
      '예시 기본값 그대로임 — 고유 랜덤값으로 교체 필요',
    );

// 서버가 읽는 환경변수 전체 목록. 코드는 process.env 대신 여기서 export 한 env 만 읽는다(env.spec.ts 가 강제).
// 키를 추가·삭제하면 .env.example 도 같이 고친다(역시 env.spec.ts 가 강제).
export const envShape = {
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(8000),
  FRONTEND_URL: z.url(),
  CORS_ORIGINS: csv(z.url()).default(['http://localhost:3000']),
  // 리버스 프록시 신뢰 홉 수(숫자) 또는 'true'/CIDR — 미설정이면 비활성
  TRUST_PROXY: z.string().optional(),

  DATABASE_URL: z.url({ protocol: /^(mysql|mariadb)$/ }),
  // DB 백업 저장 경로 — 미설정이면 <cwd>/backups
  BACKUP_DIR: z.string().optional(),

  // 용도별 JWT 시크릿(access·refresh·vault) — 서로 달라야 한다(아래 distinct)
  JWT_SECRET: secret(),
  JWT_REFRESH_SECRET: secret(),
  JWT_VAULT_SECRET: secret(),
  // AES-256-GCM 키 — 계정 비밀번호·신원 번호·ENV 값 암호화
  CREDENTIAL_SECRET: secret(),

  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.url(),
  // 로그인 허용 이메일 — 비면 부팅 실패. 빈 리스트가 "전체 허용"으로 조용히 바뀌는 것을 막는다
  ALLOWED_EMAILS: csv(z.email().toLowerCase()),

  // 파일 보관함 (Backblaze B2, S3 호환)
  B2_KEY_ID: z.string(),
  B2_APPLICATION_KEY: z.string(),
  B2_BUCKET_NAME: z.string(),
  B2_BUCKET_REGION: z.string(),
  B2_ENDPOINT: z.url(),

  // 공휴일 API — 미설정이면 캘린더 공휴일 표시만 꺼진다
  HOLIDAY_API_KEY: z.string().optional(),

  // 웹 푸시 — 키 쌍이 없으면 푸시만 꺼진다(앱 내 알림은 정상)
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:admin@docnexus.local'),

  // SMTP 메일 — HOST·USER·PASS 가 없으면 메일 발송만 꺼진다
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
};

export const envOptions = {
  // 단위 테스트(jest 는 NODE_ENV=test)는 로컬 .env 에 흔들리지 않게 test/setup-env.ts 의 고정값만 쓴다
  envFile: process.env.NODE_ENV === 'test' ? false : '.env',
  distinct: [['JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_VAULT_SECRET']],
  // 일부만 있으면 해당 기능이 조용히 꺼진다 — 부팅에서 드러낸다
  allOrNone: [
    ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'],
    ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'],
  ],
} satisfies Parameters<typeof defineEnv<typeof envShape>>[1];

// 이 파일을 import 하는 순간 .env 로드 + 검증이 끝난다 — main.ts 의 import 순서에 기대지 않는다.
// 틀린 키가 있으면 전부 모아 출력하고 부팅을 멈춘다
export const env = defineEnv(envShape, envOptions);
