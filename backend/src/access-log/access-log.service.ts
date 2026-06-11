import { Injectable, Logger } from '@nestjs/common';
import { AccessAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ClientInfo } from '../common/client-info.decorator';

// 로그 기록 대상 (열람한 보관함 레코드)
export interface AccessTarget {
  type: 'credential' | 'identity' | 'env' | 'security' | 'account';
  id: number;
  name: string;
}

@Injectable()
export class AccessLogService {
  private readonly logger = new Logger(AccessLogService.name);

  constructor(private prisma: PrismaService) {}

  // 민감정보 열람 1건 기록. 로깅 실패가 본 기능(복호화 응답)을 막지 않도록 예외를 삼킨다
  async log(
    userId: number,
    action: AccessAction,
    target: AccessTarget,
    client?: ClientInfo,
  ): Promise<void> {
    try {
      await this.prisma.accessLog.create({
        data: {
          user_id: userId,
          action,
          target_type: target.type,
          target_id: target.id,
          target_name: target.name.slice(0, 200),
          ip: client?.ip ?? null,
          user_agent: client?.userAgent ?? null,
        },
      });
    } catch (e) {
      this.logger.warn(`접근 로그 기록 실패: ${(e as Error).message}`);
    }
  }

  // 최근 열람 목록 (최신순)
  async recent(userId: number, limit = 50) {
    const rows = await this.prisma.accessLog.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      targetName: r.target_name,
      ip: r.ip,
      userAgent: r.user_agent,
      at: r.created_at.toISOString(),
    }));
  }
}
