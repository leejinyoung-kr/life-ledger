import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// soft-delete 패턴을 공유하는 Prisma delegate 의 최소 인터페이스
interface SoftDeleteDelegate {
  findMany(args: unknown): Promise<Record<string, unknown>[]>;
  update(args: unknown): Promise<unknown>;
  delete(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
}

// 휴지통이 모으는 도메인 종류
type Kind =
  | 'transaction' | 'saving' | 'investment' | 'subscription'
  | 'asset' | 'task' | 'goal' | 'note' | 'calendar';

const DAY = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 30; // 30일 보관 후 자동 영구삭제 정책

@Injectable()
export class TrashService {
  constructor(private prisma: PrismaService) {}

  // 종류별 메타 — delegate(테이블)·라벨·칩·표시명 추출 함수
  private sources(): Record<
    Kind,
    { delegate: SoftDeleteDelegate; label: string; chip: string; name: (r: Record<string, unknown>) => string }
  > {
    const p = this.prisma as unknown as Record<string, SoftDeleteDelegate>;
    return {
      transaction: { delegate: p.transaction, label: '가계부', chip: '💰 가계부', name: (r) => String(r.title) },
      saving: { delegate: p.saving, label: '예적금', chip: '🏦 예적금', name: (r) => String(r.name) },
      investment: { delegate: p.investment, label: '투자', chip: '📈 투자', name: (r) => String(r.name) },
      subscription: { delegate: p.subscription, label: '구독', chip: '📺 구독', name: (r) => String(r.name) },
      asset: { delegate: p.asset, label: '자산', chip: '💼 자산', name: (r) => String(r.name) },
      task: { delegate: p.task, label: '할일', chip: '✅ 할일', name: (r) => String(r.text) },
      goal: { delegate: p.goal, label: '목표', chip: '🎯 목표', name: (r) => String(r.name) },
      note: { delegate: p.note, label: '메모', chip: '📝 메모', name: (r) => String(r.title) },
      calendar: { delegate: p.calendarEvent, label: '일정', chip: '📅 일정', name: (r) => String(r.title) },
    };
  }

  // 종류 검증 후 메타 반환
  private sourceOf(kind: string) {
    const src = this.sources()[kind as Kind];
    if (!src) throw new BadRequestException('알 수 없는 휴지통 종류입니다.');
    return src;
  }

  // 전체 삭제 항목 통합 목록 (삭제 최신순). daysLeft = 30 - 경과일
  async findAll(userId: number) {
    const sources = this.sources();
    const lists = await Promise.all(
      (Object.keys(sources) as Kind[]).map(async (kind) => {
        const src = sources[kind];
        const rows = await src.delegate.findMany({
          where: { user_id: userId, deleted_at: { not: null } },
          orderBy: { deleted_at: 'desc' },
        });
        return rows.map((r) => {
          const deletedAt = r.deleted_at as Date;
          const elapsed = Math.floor((Date.now() - deletedAt.getTime()) / DAY);
          return {
            kind,
            type: src.label,
            chip: src.chip,
            id: r.id as number,
            name: src.name(r),
            deletedAt: deletedAt.toISOString(),
            daysLeft: Math.max(0, RETENTION_DAYS - elapsed),
          };
        });
      }),
    );
    return lists.flat().sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
  }

  // 단일 복구 (deleted_at = null)
  async restore(userId: number, kind: string, id: number) {
    const src = this.sourceOf(kind);
    const res = await src.delegate.updateMany({
      where: { id, user_id: userId, deleted_at: { not: null } },
      data: { deleted_at: null },
    });
    if (res.count === 0) throw new NotFoundException('복구할 항목을 찾을 수 없습니다.');
    return { kind, id };
  }

  // 단일 영구 삭제 (hard delete) — 본인 소유 + 삭제 상태인 행만
  async purge(userId: number, kind: string, id: number) {
    const src = this.sourceOf(kind);
    const target = await src.delegate.findMany({
      where: { id, user_id: userId, deleted_at: { not: null } },
    });
    if (target.length === 0) throw new NotFoundException('삭제할 항목을 찾을 수 없습니다.');
    await src.delegate.delete({ where: { id } });
    return { kind, id };
  }

  // 전체 복구 (모든 종류의 삭제 항목 복원)
  async restoreAll(userId: number) {
    const sources = this.sources();
    let restored = 0;
    for (const kind of Object.keys(sources) as Kind[]) {
      const res = await sources[kind].delegate.updateMany({
        where: { user_id: userId, deleted_at: { not: null } },
        data: { deleted_at: null },
      });
      restored += res.count;
    }
    return { restored };
  }

  // 휴지통 비우기 (모든 종류의 삭제 항목 영구 삭제)
  async empty(userId: number) {
    const p = this.prisma as unknown as Record<string, { deleteMany(args: unknown): Promise<{ count: number }> }>;
    const models = ['transaction', 'saving', 'investment', 'subscription', 'asset', 'task', 'goal', 'note', 'calendarEvent'];
    let purged = 0;
    for (const m of models) {
      const res = await p[m].deleteMany({ where: { user_id: userId, deleted_at: { not: null } } });
      purged += res.count;
    }
    return { purged };
  }
}
