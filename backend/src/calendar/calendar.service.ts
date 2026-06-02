import { Injectable, NotFoundException } from '@nestjs/common';
import { CalendarEvent, Prisma } from '@prisma/client';
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

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  // 엔티티 → 응답 DTO
  private toDto(e: CalendarEvent) {
    return {
      id: e.id,
      date: toDateStr(e.date),
      type: e.type,
      title: e.title,
      memo: e.memo,
    };
  }

  // 일정 목록 — month(YYYY-MM) 지정 시 해당 월만
  async findAll(userId: number, month?: string) {
    const where: Prisma.CalendarEventWhereInput = { user_id: userId, deleted_at: null };
    if (month) where.date = monthRange(month);
    const rows = await this.prisma.calendarEvent.findMany({
      where,
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  // 다가오는 일정 — 오늘 이후 가까운 순 (남은 일수 포함)
  async upcoming(userId: number, limit = 5) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const rows = await this.prisma.calendarEvent.findMany({
      where: { user_id: userId, deleted_at: null, date: { gte: today } },
      orderBy: { date: 'asc' },
      take: limit,
    });
    return rows.map((r) => ({
      ...this.toDto(r),
      daysUntil: Math.round((r.date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
    }));
  }

  // 일정 추가
  async create(userId: number, dto: CreateEventDto) {
    const created = await this.prisma.calendarEvent.create({
      data: {
        user_id: userId,
        date: new Date(dto.date),
        type: dto.type,
        title: dto.title,
        memo: dto.memo,
      },
    });
    return this.toDto(created);
  }

  // 본인 소유 + 미삭제 확인
  private async findOwned(userId: number, id: number): Promise<CalendarEvent> {
    const row = await this.prisma.calendarEvent.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('일정을 찾을 수 없습니다.');
    return row;
  }

  // 일정 수정
  async update(userId: number, id: number, dto: UpdateEventDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.calendarEvent.update({
      where: { id },
      data: {
        date: dto.date ? new Date(dto.date) : undefined,
        type: dto.type,
        title: dto.title,
        memo: dto.memo,
      },
    });
    return this.toDto(updated);
  }

  // 일정 삭제 (soft delete)
  async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await this.prisma.calendarEvent.update({ where: { id }, data: { deleted_at: new Date() } });
    return { id };
  }
}
