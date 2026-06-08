/**
 * ENV 보관함 더미 — 프로젝트 + dev/staging/prod 변수(AES) + 값 변경 이력(롤백 데모).
 * CREDENTIAL_SECRET 미설정 시 건너뜀(암호화 불가).
 */
import type { EnvKind } from '@prisma/client';
import { canEncrypt, enc, type SeedFn } from './helpers';

type VarSeed = { env: EnvKind; group: string | null; key: string; value: string };

const VARS: VarSeed[] = [
  { env: 'dev', group: 'database', key: 'DATABASE_URL', value: 'mysql://root:root@localhost:3306/docnexus_dev' },
  { env: 'dev', group: 'auth', key: 'JWT_SECRET', value: 'dev-jwt-secret-0001' },
  { env: 'dev', group: 'api', key: 'OPENAI_API_KEY', value: 'sk-proj-dev-xxxx' },
  { env: 'staging', group: 'database', key: 'DATABASE_URL', value: 'mysql://app:stg@stg-db:3306/docnexus' },
  { env: 'staging', group: 'auth', key: 'JWT_SECRET', value: 'stg-jwt-secret-7777' },
  { env: 'prod', group: 'database', key: 'DATABASE_URL', value: 'mysql://app:prod@prod-db:3306/docnexus' },
  { env: 'prod', group: 'auth', key: 'JWT_SECRET', value: 'prod-jwt-secret-9999' },
  { env: 'prod', group: 'storage', key: 'B2_BUCKET_NAME', value: 'docnexus-prod' },
];

// DATABASE_URL(prod) 의 이전 값들 — 롤백 데모용 이력
const HISTORY_FOR = { env: 'prod' as EnvKind, key: 'DATABASE_URL' };
const HISTORY_VALUES = [
  'mysql://app:prod@old-db:3306/docnexus',
  'mysql://root:root@prod-db:3306/docnexus',
];

// 한 사용자에게 ENV 더미를 채운다 (기존 프로젝트/변수/이력 제거 후 재삽입 → idempotent)
export const seedEnv: SeedFn = async (prisma, userId) => {
  if (!canEncrypt()) {
    console.warn('  ⚠️ CREDENTIAL_SECRET 미설정 — ENV 더미 건너뜀');
    return 0;
  }

  // 기존 정리 (이력 → 변수 → 프로젝트 순서, FK 안전)
  const projects = await prisma.envProject.findMany({ where: { user_id: userId }, select: { id: true } });
  if (projects.length) {
    const pids = projects.map((p) => p.id);
    const vars = await prisma.envVar.findMany({ where: { project_id: { in: pids } }, select: { id: true } });
    if (vars.length) await prisma.envVarHistory.deleteMany({ where: { env_var_id: { in: vars.map((v) => v.id) } } });
    await prisma.envVar.deleteMany({ where: { project_id: { in: pids } } });
    await prisma.envProject.deleteMany({ where: { id: { in: pids } } });
  }

  const project = await prisma.envProject.create({
    data: { user_id: userId, name: 'DocNexus', description: '메인 서비스 환경변수' },
  });

  for (const v of VARS) {
    await prisma.envVar.create({
      data: {
        user_id: userId,
        project_id: project.id,
        env: v.env,
        group: v.group,
        key: v.key,
        value_enc: enc(v.value),
      },
    });
  }

  // 이력 추가 — DATABASE_URL(prod) 의 과거 값들
  const target = await prisma.envVar.findFirst({
    where: { user_id: userId, project_id: project.id, env: HISTORY_FOR.env, key: HISTORY_FOR.key },
    select: { id: true },
  });
  if (target) {
    for (const old of HISTORY_VALUES) {
      await prisma.envVarHistory.create({
        data: { env_var_id: target.id, user_id: userId, value_enc: enc(old) },
      });
    }
  }

  return VARS.length + HISTORY_VALUES.length;
};
