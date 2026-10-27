import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type SysLogLevel = 'info' | 'warn' | 'error';
export type SysLogCategory = 'recurring_buy' | 'recurring_tx' | 'cron' | 'asset' | 'file' | 'security' | 'notification';

export interface SysLogOptions {
  userId?: number;
  category: SysLogCategory;
  message: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SystemLogService {
  private readonly logger = new Logger(SystemLogService.name);

  constructor(private prisma: PrismaService) {}

  info(opts: SysLogOptions): void { this.write('info', opts); }
  warn(opts: SysLogOptions): void { this.write('warn', opts); }
  error(opts: SysLogOptions): void { this.write('error', opts); }

  // fire-and-forget — 로그 기록 실패가 호출부 로직에 영향을 주지 않도록 catch 처리
  private write(level: SysLogLevel, opts: SysLogOptions): void {
    this.prisma.systemLog.create({
      data: {
        user_id: opts.userId ?? null,
        level,
        category: opts.category,
        message: opts.message,
        metadata: opts.metadata as unknown as Prisma.InputJsonValue ?? undefined,
      },
    }).catch((e: unknown) => {
      this.logger.error(`시스템 로그 기록 실패: ${(e as Error).message}`);
    });
  }

  // 시스템 로그 조회 — 본인 로그 + 사용자 없는 전역 작업(크론 등) 로그만. 페이지 크기는 1~100 으로 제한
  async findAll(userId: number, params: {
    level?: string;
    category?: string;
    from?: string;
    to?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const { level, category, from, to, q } = params;
    const page = Math.max(1, Math.floor(params.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Math.floor(params.limit ?? 20) || 20));
    const where: Record<string, unknown> = { OR: [{ user_id: userId }, { user_id: null }] };
    if (level) where.level = level;
    if (category) where.category = category;
    if (from || to) {
      // from · to 는 화면에서 고른 한국 날짜(YYYY-MM-DD) — 그날 KST 0시 ~ 23:59:59.999 로 자른다 (서버 TZ 와 무관)
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(`${from}T00:00:00+09:00`);
      if (to) dateFilter.lte = new Date(`${to}T23:59:59.999+09:00`);
      where.created_at = dateFilter;
    }
    if (q) where.message = { contains: q };

    const [items, total] = await Promise.all([
      this.prisma.systemLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.systemLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}
