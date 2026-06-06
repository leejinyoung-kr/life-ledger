import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, CalendarEvent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

// Date → 'YYYY-MM-DD'
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// 'YYYY-MM' → 해당 월 [시작, 다음달 시작) 범위
function monthRange(month: string): { gte: Date; lt: Date } {
  const [y, m] = month.split('-').map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
}

// 가상 이벤트 ID 오프셋 — 실제 calendar_event.id 와 충돌하지 않도록 큰 값 사용
const VIRT_OFFSET = { subscription: 1_000_000, saving: 2_000_000, identity: 3_000_000, task: 4_000_000 };
type VirtSource = keyof typeof VIRT_OFFSET;

// 가상 이벤트 ID → {sourceType, sourceId} 역산. 실제 이벤트면 null
function decodeVirtId(id: number): { sourceType: VirtSource; sourceId: number } | null {
  if (id >= VIRT_OFFSET.task)         return { sourceType: 'task',         sourceId: id - VIRT_OFFSET.task };
  if (id >= VIRT_OFFSET.identity)     return { sourceType: 'identity',     sourceId: id - VIRT_OFFSET.identity };
  if (id >= VIRT_OFFSET.saving)       return { sourceType: 'saving',       sourceId: id - VIRT_OFFSET.saving };
  if (id >= VIRT_OFFSET.subscription) return { sourceType: 'subscription', sourceId: id - VIRT_OFFSET.subscription };
  return null;
}

export interface CalEventDto {
  id: number;
  date: string;
  type: string;
  title: string;
  memo: string | null;
  virtual: boolean;
  sourceType?: VirtSource;
}

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  // 실제 CalendarEvent 엔티티 → DTO
  private toDto(e: CalendarEvent): CalEventDto {
    return { id: e.id, date: toDateStr(e.date), type: e.type, title: e.title, memo: e.memo, virtual: false };
  }

  // 4개 테이블에서 가상 이벤트 수집 (dateFilter 없으면 전체)
  private async virtualEvents(userId: number, dateFilter?: { gte: Date; lt?: Date }): Promise<CalEventDto[]> {
    const [subs, savings, identities, tasks] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { user_id: userId, deleted_at: null, ...(dateFilter ? { next_payment_date: dateFilter } : {}) },
        select: { id: true, name: true, amount: true, next_payment_date: true },
      }),
      this.prisma.saving.findMany({
        where: { user_id: userId, deleted_at: null, maturity_date: { not: null, ...(dateFilter ?? {}) } },
        select: { id: true, name: true, maturity_date: true },
      }),
      this.prisma.identityCard.findMany({
        where: { user_id: userId, deleted_at: null, expire_date: { not: null, ...(dateFilter ?? {}) } },
        select: { id: true, name: true, expire_date: true },
      }),
      this.prisma.task.findMany({
        where: { user_id: userId, deleted_at: null, done: false, due_date: { not: null, ...(dateFilter ?? {}) } },
        select: { id: true, text: true, due_date: true },
      }),
    ]);

    const result: CalEventDto[] = [];

    subs.forEach((s) =>
      result.push({ id: VIRT_OFFSET.subscription + s.id, date: toDateStr(s.next_payment_date), type: 'pay', title: `${s.name} · ${Number(s.amount).toLocaleString('ko-KR')}원`, memo: null, virtual: true, sourceType: 'subscription' }),
    );
    savings.forEach((s) => {
      if (!s.maturity_date) return;
      result.push({ id: VIRT_OFFSET.saving + s.id, date: toDateStr(s.maturity_date), type: 'due', title: `${s.name} 만기`, memo: null, virtual: true, sourceType: 'saving' });
    });
    identities.forEach((i) => {
      if (!i.expire_date) return;
      result.push({ id: VIRT_OFFSET.identity + i.id, date: toDateStr(i.expire_date), type: 'exp', title: `${i.name} 만료`, memo: null, virtual: true, sourceType: 'identity' });
    });
    tasks.forEach((t) => {
      if (!t.due_date) return;
      result.push({ id: VIRT_OFFSET.task + t.id, date: toDateStr(t.due_date), type: 'task', title: t.text, memo: null, virtual: true, sourceType: 'task' });
    });

    return result;
  }

  // 일정 목록 — month(YYYY-MM) 지정 시 해당 월만. 실제 + 가상 합산
  async findAll(userId: number, month?: string) {
    const range = month ? monthRange(month) : undefined;
    const where: Prisma.CalendarEventWhereInput = { user_id: userId, deleted_at: null };
    if (range) where.date = range;

    const [rows, virtual] = await Promise.all([
      this.prisma.calendarEvent.findMany({ where, orderBy: [{ date: 'asc' }, { id: 'asc' }] }),
      this.virtualEvents(userId, range),
    ]);

    return [...rows.map((r) => this.toDto(r)), ...virtual].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  }

  // 다가오는 일정 — 오늘 이후 가까운 순. 실제 + 가상 합산 후 limit 적용
  async upcoming(userId: number, limit = 5) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [rows, virtual] = await Promise.all([
      this.prisma.calendarEvent.findMany({
        where: { user_id: userId, deleted_at: null, date: { gte: today } },
        orderBy: { date: 'asc' },
      }),
      this.virtualEvents(userId, { gte: today }),
    ]);

    const addDays = (ev: CalEventDto) => ({
      ...ev,
      daysUntil: Math.round((new Date(ev.date).getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
    });

    return [...rows.map((r) => addDays(this.toDto(r))), ...virtual.map(addDays)]
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
      .slice(0, limit);
  }

  // 일정 추가 (수동 등록만)
  async create(userId: number, dto: CreateEventDto) {
    const created = await this.prisma.calendarEvent.create({
      data: { user_id: userId, date: new Date(dto.date), type: dto.type, title: dto.title, memo: dto.memo },
    });
    return this.toDto(created);
  }

  // 본인 소유 + 미삭제 확인
  private async findOwned(userId: number, id: number): Promise<CalendarEvent> {
    const row = await this.prisma.calendarEvent.findFirst({ where: { id, user_id: userId, deleted_at: null } });
    if (!row) throw new NotFoundException('일정을 찾을 수 없습니다.');
    return row;
  }

  // 일정 수정 (수동 등록 이벤트만)
  async update(userId: number, id: number, dto: UpdateEventDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.calendarEvent.update({
      where: { id },
      data: { date: dto.date ? new Date(dto.date) : undefined, type: dto.type, title: dto.title, memo: dto.memo },
    });
    return this.toDto(updated);
  }

  // 일정 삭제 — 실제 이벤트: soft delete / 가상 이벤트: 원본 테이블 soft delete
  async remove(userId: number, id: number) {
    const virt = decodeVirtId(id);
    if (virt) {
      await this.removeVirtual(userId, virt.sourceType, virt.sourceId);
      return { id };
    }
    await this.findOwned(userId, id);
    await this.prisma.calendarEvent.update({ where: { id }, data: { deleted_at: new Date() } });
    return { id };
  }

  // 원본 테이블별 soft delete
  private async removeVirtual(userId: number, sourceType: VirtSource, sourceId: number) {
    const now = new Date();
    switch (sourceType) {
      case 'subscription':
        await this.prisma.subscription.updateMany({ where: { id: sourceId, user_id: userId }, data: { deleted_at: now } });
        break;
      case 'saving':
        await this.prisma.saving.updateMany({ where: { id: sourceId, user_id: userId }, data: { deleted_at: now } });
        break;
      case 'identity':
        await this.prisma.identityCard.updateMany({ where: { id: sourceId, user_id: userId }, data: { deleted_at: now } });
        break;
      case 'task':
        await this.prisma.task.updateMany({ where: { id: sourceId, user_id: userId }, data: { deleted_at: now } });
        break;
    }
  }
}
