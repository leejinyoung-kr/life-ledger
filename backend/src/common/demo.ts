import { ForbiddenException } from '@nestjs/common';
import { env } from '../config/env';

// 데모 인스턴스의 고정 사용자 — 방문자 모두가 이 계정 하나를 같이 쓴다(prisma/seed.ts 의 ensureUsers 와 같은 이메일)
export const DEMO_EMAIL = 'demo@life-ledger.local';

// 데모 마스터 잠금 비밀번호 — 화면의 데모 띠에 보여 주고, 매일 초기화 때 다시 건다(비밀이 아니다)
export const DEMO_VAULT_PASSWORD = 'demo1234';

// 데모에서는 다른 방문자를 방해하는 동작(계정 삭제 · 마스터 잠금 변경 등)을 막는다 — 운영에서는 아무 일도 하지 않는다
export function assertNotDemo(action: string): void {
  if (env.DEMO_MODE) throw new ForbiddenException(`데모에서는 ${action}할 수 없습니다.`);
}
