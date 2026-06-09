import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

// 헬스체크 — 오케스트레이터(Docker/k8s) probe 용. 토큰 없이 접근 허용.
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // DB 핑(SELECT 1)까지 확인 — DB 끊기면 503 으로 응답해 probe 가 실패를 감지하게 한다.
  @Public()
  @Get()
  async check() {
    let db = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    const payload = {
      status: db ? 'ok' : 'error',
      db: db ? 'up' : 'down',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
    if (!db) throw new ServiceUnavailableException(payload);
    return payload;
  }
}
