import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type SysLogLevel = 'info' | 'warn' | 'error';
export type SysLogCategory = 'recurring_buy' | 'recurring_tx' | 'cron' | 'asset' | 'file' | 'security' | 'ai';

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

  async findAll(params: {
    level?: string;
    category?: string;
    from?: string;
    to?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const { level, category, from, to, q, page = 1, limit = 20 } = params;
    const where: Record<string, unknown> = {};
    if (level) where.level = level;
    if (category) where.category = category;
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
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
