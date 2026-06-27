import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, CalendarEvent, CalRecurFreq } from '@prisma/client';
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

// 기준일에서 주/월/년 단위로 n회 뒤 날짜 (월/년은 말일 클램프 — 예: 1/31 + 1개월 = 2/28)
function addPeriod(base: Date, freq: 'weekly' | 'monthly' | 'yearly', n: number): Date {
  if (freq === 'weekly') return new Date(base.getTime() + n * 7 * 24 * 60 * 60 * 1000);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const day = base.getUTCDate();
  const targetMonthIndex = freq === 'yearly' ? m : m + n;
  const targetYear = freq === 'yearly' ? y + n : y;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonthIndex, Math.min(day, lastDayOfTargetMonth)));
}

// 반복 일정이 [range.gte, range.lt) 안에서 발생하는 날짜들 (반복 없으면 원본 날짜 1건)
function occurrencesInRange(base: Date, freq: CalRecurFreq, until: Date | null, range: { gte: Date; lt: Date }): Date[] {
  if (freq === 'none') return base >= range.gte && base < range.lt ? [base] : [];
  const dates: Date[] = [];
  for (let n = 0; n < 1000; n++) {
    const occ = addPeriod(base, freq, n);
    if (occ >= range.lt || (until && occ > until)) break;
    if (occ >= range.gte) dates.push(occ);
  }
  return dates;
}

// 반복 일정의 from(포함) 이후 가장 가까운 발생일 (없으면 null)
function nextOccurrenceOnOrAfter(base: Date, freq: CalRecurFreq, until: Date | null, from: Date): Date | null {
  if (freq === 'none') return base >= from ? base : null;
  for (let n = 0; n < 1000; n++) {
    const occ = addPeriod(base, freq, n);
    if (until && occ > until) return null;
    if (occ >= from) return occ;
  }
  return null;
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
  recurFreq?: CalRecurFreq;
  recurUntil?: string | null;
}

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  // 실제 CalendarEvent 엔티티 → DTO (occurrenceDate 지정 시 반복 일정의 특정 발생일로 표시)
  private toDto(e: CalendarEvent, occurrenceDate?: Date): CalEventDto {
    return {
      id: e.id,
      date: toDateStr(occurrenceDate ?? e.date),
      type: e.type,
      title: e.title,
      memo: e.memo,
      virtual: false,
      recurFreq: e.recur_freq,
      recurUntil: e.recur_until ? toDateStr(e.recur_until) : null,
    };
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

  // 일정 목록 — month(YYYY-MM) 지정 시 해당 월만. 실제(반복 발생 포함) + 가상 합산
  async findAll(userId: number, month?: string) {
    const range = month ? monthRange(month) : undefined;
    const where: Prisma.CalendarEventWhereInput = { user_id: userId, deleted_at: null };
    if (range) {
      where.OR = [
        { recur_freq: 'none', date: range },
        { recur_freq: { not: 'none' }, date: { lt: range.lt }, OR: [{ recur_until: null }, { recur_until: { gte: range.gte } }] },
      ];
    }

    const [rows, virtual] = await Promise.all([
      this.prisma.calendarEvent.findMany({ where, orderBy: [{ date: 'asc' }, { id: 'asc' }] }),
      this.virtualEvents(userId, range),
    ]);

    const expanded = range
      ? rows.flatMap((r) =>
          r.recur_freq === 'none'
            ? [this.toDto(r)]
            : occurrencesInRange(r.date, r.recur_freq, r.recur_until, range).map((d) => this.toDto(r, d)),
        )
      : rows.map((r) => this.toDto(r));

    return [...expanded, ...virtual].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  }

  // 다가오는 일정 — 오늘 이후 가까운 순(반복 일정은 다음 발생일 1건). 실제 + 가상 합산 후 limit 적용
  async upcoming(userId: number, limit = 5) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [rows, virtual] = await Promise.all([
      this.prisma.calendarEvent.findMany({
        where: {
          user_id: userId,
          deleted_at: null,
          OR: [
            { recur_freq: 'none', date: { gte: today } },
            { recur_freq: { not: 'none' }, OR: [{ recur_until: null }, { recur_until: { gte: today } }] },
          ],
        },
        orderBy: { date: 'asc' },
      }),
      this.virtualEvents(userId, { gte: today }),
    ]);

    const addDays = (ev: CalEventDto) => ({
      ...ev,
      daysUntil: Math.round((new Date(ev.date).getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
    });

    const upcomingRows = rows
      .map((r) => {
        const occ = r.recur_freq === 'none' ? r.date : nextOccurrenceOnOrAfter(r.date, r.recur_freq, r.recur_until, today);
        return occ ? this.toDto(r, occ) : null;
      })
      .filter((d): d is CalEventDto => d !== null);

    return [...upcomingRows.map(addDays), ...virtual.map(addDays)]
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
      .slice(0, limit);
  }

  // 일정 추가 (수동 등록만)
  async create(userId: number, dto: CreateEventDto) {
    const created = await this.prisma.calendarEvent.create({
      data: {
        user_id: userId,
        date: new Date(dto.date),
        type: dto.type,
        title: dto.title,
        memo: dto.memo,
        recur_freq: dto.recurFreq ?? 'none',
        recur_until: dto.recurUntil ? new Date(dto.recurUntil) : null,
      },
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
      data: {
        date: dto.date ? new Date(dto.date) : undefined,
        type: dto.type,
        title: dto.title,
        memo: dto.memo,
        recur_freq: dto.recurFreq,
        recur_until: dto.recurUntil !== undefined ? (dto.recurUntil ? new Date(dto.recurUntil) : null) : undefined,
      },
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
