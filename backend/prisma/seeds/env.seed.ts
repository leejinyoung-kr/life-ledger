/**
 * ENV 보관함 더미 — 여러 프로젝트 + dev/prod 변수(AES) + 값 변경 이력(롤백 데모).
 * 앱과 같은 키링(backend/.env 의 CRYPTO_KEYS)·문맥으로 암호화 — 이력도 변수와 같은 문맥.
 */
import type { EnvKind } from '@prisma/client';
import { enc, type SeedFn } from './helpers';

type VarSeed = { env: EnvKind; group: string | null; key: string; value: string };

type ProjectSeed = {
  name: string;
  description: string;
  vars: VarSeed[];
  // 롤백 데모용 — 특정 변수의 과거 값들 (최신→과거 순)
  history?: { env: EnvKind; key: string; values: string[] };
};

const PROJECTS: ProjectSeed[] = [
  {
    name: 'DocNexus',
    description: '메인 서비스 환경변수',
    vars: [
      { env: 'dev', group: 'database', key: 'DATABASE_URL', value: 'mysql://root:root@localhost:3306/docnexus_dev' },
      { env: 'dev', group: 'auth', key: 'JWT_SECRET', value: 'dev-jwt-secret-0001' },
      { env: 'dev', group: 'auth', key: 'CREDENTIAL_SECRET', value: 'dev-credential-secret-aaaa' },
      { env: 'dev', group: 'api', key: 'OPENAI_API_KEY', value: 'sk-proj-dev-xxxx' },
      { env: 'prod', group: 'database', key: 'DATABASE_URL', value: 'mysql://app:prod@prod-db:3306/docnexus' },
      { env: 'prod', group: 'auth', key: 'JWT_SECRET', value: 'prod-jwt-secret-9999' },
      { env: 'prod', group: 'auth', key: 'CREDENTIAL_SECRET', value: 'prod-credential-secret-zzzz' },
      { env: 'prod', group: 'storage', key: 'B2_BUCKET_NAME', value: 'docnexus-prod' },
      { env: 'prod', group: 'storage', key: 'B2_KEY_ID', value: '0011223344556677' },
      { env: 'prod', group: 'storage', key: 'B2_APP_KEY', value: 'K001abcdefgHIJKLmnop' },
      { env: 'prod', group: 'api', key: 'OPENAI_API_KEY', value: 'sk-proj-prod-yyyy' },
      { env: 'prod', group: 'auth', key: 'GOOGLE_CLIENT_ID', value: '1234567890-prod.apps.googleusercontent.com' },
      { env: 'prod', group: 'auth', key: 'GOOGLE_CLIENT_SECRET', value: 'GOCSPX-prod-secret-0000' },
    ],
    history: {
      env: 'prod',
      key: 'DATABASE_URL',
      values: ['mysql://app:prod@old-db:3306/docnexus', 'mysql://root:root@prod-db:3306/docnexus'],
    },
  },
  {
    name: '개인 블로그',
    description: 'Next.js 블로그 + Vercel 배포',
    vars: [
      { env: 'dev', group: 'database', key: 'POSTGRES_URL', value: 'postgres://localhost:5432/blog_dev' },
      { env: 'dev', group: 'app', key: 'NEXT_PUBLIC_SITE_URL', value: 'http://localhost:3000' },
      { env: 'prod', group: 'database', key: 'POSTGRES_URL', value: 'postgres://app:pw@neon.tech/blog' },
      { env: 'prod', group: 'app', key: 'NEXT_PUBLIC_SITE_URL', value: 'https://myblog.dev' },
      { env: 'prod', group: 'api', key: 'RESEND_API_KEY', value: 're_prod_1234567890' },
      { env: 'prod', group: 'api', key: 'GA_MEASUREMENT_ID', value: 'G-ABCDEF1234' },
    ],
    history: {
      env: 'prod',
      key: 'RESEND_API_KEY',
      values: ['re_prod_old_9999'],
    },
  },
  {
    name: '사이드 프로젝트 — 봇',
    description: 'Discord 알림 봇',
    vars: [
      { env: 'prod', group: 'auth', key: 'DISCORD_BOT_TOKEN', value: 'MTIzNDU2Nzg5.GhIjKl.mNoPqRsTuVwXyZ' },
      { env: 'prod', group: 'api', key: 'WEBHOOK_URL', value: 'https://discord.com/api/webhooks/123/abc' },
      { env: 'prod', group: 'app', key: 'CRON_SCHEDULE', value: '0 9 * * *' },
    ],
  },
];

// 한 사용자에게 ENV 더미를 채운다 (기존 프로젝트/변수/이력 제거 후 재삽입 → idempotent)
export const seedEnv: SeedFn = async (prisma, userId) => {
  // 기존 정리 (이력 → 변수 → 프로젝트 순서, FK 안전)
  const projects = await prisma.envProject.findMany({ where: { user_id: userId }, select: { id: true } });
  if (projects.length) {
    const pids = projects.map((p) => p.id);
    const vars = await prisma.envVar.findMany({ where: { project_id: { in: pids } }, select: { id: true } });
    if (vars.length) await prisma.envVarHistory.deleteMany({ where: { env_var_id: { in: vars.map((v) => v.id) } } });
    await prisma.envVar.deleteMany({ where: { project_id: { in: pids } } });
    await prisma.envProject.deleteMany({ where: { id: { in: pids } } });
  }

  let count = 0;

  for (const p of PROJECTS) {
    const project = await prisma.envProject.create({
      data: { user_id: userId, name: p.name, description: p.description },
    });

    for (const v of p.vars) {
      await prisma.envVar.create({
        data: {
          user_id: userId,
          project_id: project.id,
          env: v.env,
          group: v.group,
          key: v.key,
          value_enc: enc(v.value, 'envVar.value_enc', userId),
        },
      });
    }
    count += p.vars.length;

    // 이력 추가 — 지정한 변수의 과거 값들
    if (p.history) {
      const target = await prisma.envVar.findFirst({
        where: { user_id: userId, project_id: project.id, env: p.history.env, key: p.history.key },
        select: { id: true },
      });
      if (target) {
        for (const old of p.history.values) {
          await prisma.envVarHistory.create({
            data: { env_var_id: target.id, user_id: userId, value_enc: enc(old, 'envVar.value_enc', userId) },
          });
        }
        count += p.history.values.length;
      }
    }
  }

  return count;
};
