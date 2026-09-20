import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { encryptedFields } from '@leejinyoun/core-security/prisma';
import { env } from '../config/env';
import { ENCRYPTED_FIELD_MAP } from '../crypto/crypto-fields';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaMariaDb(env.DATABASE_URL);
    super({ adapter });
    // 암호문 컬럼에 평문을 쓰면 여기서 막는다(읽기는 그대로 — 복호화는 호출부가 명시적으로 한다).
    // 확장 클라이언트를 인스턴스로 돌려줘 주입받는 쪽 코드는 그대로 둔다(모델·$transaction·수명주기 훅 모두 전달된다).
    // 재암호화·점검의 raw SQL 은 확장을 거치지 않는다 — 암호문을 직접 다루는 경로라 그대로 둔다
    return this.$extends(
      encryptedFields(ENCRYPTED_FIELD_MAP),
    ) as unknown as PrismaService;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
