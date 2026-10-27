import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, CalendarEvent, CalRecurFreq } from '@prisma/client';
import KoreanLunarCalendar from 'korean-lunar-calendar';
import { PrismaService } from '../prisma/prisma.service';
import { todayKst } from '../common/kst-date';
import { HolidayService } from '../holiday/holiday.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

// Date → 'YYYY-MM-DD'
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// 'YYYY-MM' → 해당 월 [시작, 다음달 시작) 범위
function monthRange(month: string): { gte: Date; lt: Date } {
  const [y, m] = month.split('-').map(Number);
  return {
    gte: new Date(Date.UTC(y, m - 1, 1)),
    lt: new Date(Date.UTC(y, m, 1)),
  };
}

// 기준일에서 주/월/년 단위로 n회 뒤 날짜 (월/년은 말일 클램프 — 예: 1/31 + 1개월 = 2/28)
function addPeriod(
  base: Date,
  freq: 'weekly' | 'monthly' | 'yearly',
  n: number,
): Date {
  if (freq === 'weekly')
    return new Date(base.getTime() + n * 7 * 24 * 60 * 60 * 1000);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const day = base.getUTCDate();
  const targetMonthIndex = freq === 'yearly' ? m : m + n;
  const targetYear = freq === 'yearly' ? y + n : y;
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonthIndex + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(targetYear, targetMonthIndex, Math.min(day, lastDayOfTargetMonth)),
  );
}

// 음력(lunarMonth/lunarDay) → 특정 lunarYear 기준 양력 날짜. 변환 불가(윤달 없는 해 등)면 null
function lunarToSolar(
  lunarYear: number,
  lunarMonth: number,
  lunarDay: number,
  leap: boolean,
): Date | null {
  const cal = new KoreanLunarCalendar();
  if (!cal.setLunarDate(lunarYear, lunarMonth, lunarDay, leap)) return null;
  const s = cal.getSolarCalendar();
  return new Date(Date.UTC(s.year, s.month - 1, s.day));
}

// 양력 날짜 → 음력 {month, day, intercalation(윤달 여부)}. 지원 범위(1000~2050) 밖이면 null
function solarToLunar(
  date: Date,
): { month: number; day: number; intercalation: boolean } | null {
  const cal = new KoreanLunarCalendar();
  if (!cal.setSolarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())) return null;
  const l = cal.getLunarCalendar();
  return { month: l.month, day: l.day, intercalation: !!l.intercalation };
}

// 매년 음력 반복이 [range.gte, range.lt) 안에서 발생하는 날짜들 — 연도별로 음력→양력 재변환(고정 산술 불가, 매년 날짜가 달라짐)
function lunarYearlyOccurrencesInRange(
  lunarMonth: number,
  lunarDay: number,
  leap: boolean,
  base: Date,
  until: Date | null,
  range: { gte: Date; lt: Date },
): Date[] {
  const dates: Date[] = [];
  // 연말/연초 드리프트 대비 앞뒤 1년씩 여유를 두고 순회
  for (let y = range.gte.getUTCFullYear() - 1; y <= range.lt.getUTCFullYear() + 1; y++) {
    const occ = lunarToSolar(y, lunarMonth, lunarDay, leap);
    if (!occ || occ < base || (until && occ > until)) continue;
    if (occ >= range.gte && occ < range.lt) dates.push(occ);
  }
  return dates;
}

// 매년 음력 반복의 from(포함) 이후 가장 가까운 발생일 (없으면 null)
function lunarYearlyNextOccurrenceOnOrAfter(
  lunarMonth: number,
  lunarDay: number,
  leap: boolean,
  base: Date,
  until: Date | null,
  from: Date,
): Date | null {
  for (let y = from.getUTCFullYear() - 1; y <= from.getUTCFullYear() + 50; y++) {
    const occ = lunarToSolar(y, lunarMonth, lunarDay, leap);
    if (!occ || occ < base) continue;
    if (until && occ > until) return null;
    if (occ >= from) return occ;
  }
  return null;
}

// 반복 일정이 [range.gte, range.lt) 안에서 발생하는 날짜들 (반복 없으면 원본 날짜 1건)
function occurrencesInRange(
  event: CalendarEvent,
  range: { gte: Date; lt: Date },
): Date[] {
  const { date: base, recur_freq: freq, recur_until: until } = event;
  if (freq === 'none')
    return base >= range.gte && base < range.lt ? [base] : [];
  if (event.is_lunar && freq === 'yearly' && event.lunar_month && event.lunar_day) {
    return lunarYearlyOccurrencesInRange(
      event.lunar_month,
      event.lunar_day,
      event.lunar_leap,
      base,
      until,
      range,
    );
  }
  const dates: Date[] = [];
  for (let n = 0; n < 1000; n++) {
    const occ = addPeriod(base, freq, n);
    if (occ >= range.lt || (until && occ > until)) break;
    if (occ >= range.gte) dates.push(occ);
  }
  return dates;
}

// 반복 일정의 from(포함) 이후 가장 가까운 발생일 (없으면 null)
function nextOccurrenceOnOrAfter(event: CalendarEvent, from: Date): Date | null {
  const { date: base, recur_freq: freq, recur_until: until } = event;
  if (freq === 'none') return base >= from ? base : null;
  if (event.is_lunar && freq === 'yearly' && event.lunar_month && event.lunar_day) {
    return lunarYearlyNextOccurrenceOnOrAfter(
      event.lunar_month,
      event.lunar_day,
      event.lunar_leap,
      base,
      until,
      from,
    );
  }
  for (let n = 0; n < 1000; n++) {
    const occ = addPeriod(base, freq, n);
    if (until && occ > until) return null;
    if (occ >= from) return occ;
  }
  return null;
}

// 가상 이벤트 ID 오프셋 — 실제 calendar_event.id 와 충돌하지 않도록 큰 값 사용 (holiday는 삭제 불가, 가장 높은 오프셋)
const VIRT_OFFSET = {
  subscription: 1_000_000,
  saving: 2_000_000,
  holiday: 4_000_000,
  investmentAccount: 5_000_000,
};
type VirtSource = keyof typeof VIRT_OFFSET;

// 가상 이벤트 ID → {sourceType, sourceId} 역산. 실제 이벤트면 null
function decodeVirtId(
  id: number,
): { sourceType: VirtSource; sourceId: number } | null {
  if (id >= VIRT_OFFSET.investmentAccount)
    return { sourceType: 'investmentAccount', sourceId: id - VIRT_OFFSET.investmentAccount };
  if (id >= VIRT_OFFSET.holiday)
    return { sourceType: 'holiday', sourceId: id - VIRT_OFFSET.holiday };
  if (id >= VIRT_OFFSET.saving)
    return { sourceType: 'saving', sourceId: id - VIRT_OFFSET.saving };
  if (id >= VIRT_OFFSET.subscription)
    return {
      sourceType: 'subscription',
      sourceId: id - VIRT_OFFSET.subscription,
    };
  return null;
}

export interface CalEventDto {
  id: number;
  date: string;
  type: string;
  title: string;
  memo: string | null;
  virtual: boolean;
  // 실제 일정의 원래 날짜(반복 일정이면 첫 회차) — date 는 표시 중인 회차라 수정 폼은 이 값을 쓴다
  startDate?: string;
  sourceType?: VirtSource;
  recurFreq?: CalRecurFreq;
  recurUntil?: string | null;
  isLunar?: boolean;
  lunarMonth?: number | null;
  lunarDay?: number | null;
  lunarLeap?: boolean;
  notify?: boolean;
}

@Injectable()
export class CalendarService {
  constructor(
    private prisma: PrismaService,
    private holidayService: HolidayService,
  ) {}

  // 사용자의 "공휴일 표시" 설정 조회 (설정 행이 없으면 기본값 true)
  private async showHolidays(userId: number): Promise<boolean> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { user_id: userId },
      select: { show_holidays: true },
    });
    return settings?.show_holidays ?? true;
  }

  // 공휴일을 캘린더 가상 이벤트 DTO로 변환 (삭제 불가 — id는 응답 내에서만 유일하면 됨)
  private toHolidayDtos(holidays: { date: Date; name: string; isSubstitute: boolean }[]): CalEventDto[] {
    return holidays.map((h, idx) => ({
      id: VIRT_OFFSET.holiday + idx,
      date: toDateStr(h.date),
      type: 'holiday',
      title: h.name,
      memo: null,
      virtual: true,
      sourceType: 'holiday',
    }));
  }

  // 실제 CalendarEvent 엔티티 → DTO (occurrenceDate 지정 시 반복 일정의 특정 발생일로 표시)
  private toDto(e: CalendarEvent, occurrenceDate?: Date): CalEventDto {
    return {
      id: e.id,
      date: toDateStr(occurrenceDate ?? e.date),
      type: e.type,
      title: e.title,
      memo: e.memo,
      virtual: false,
      startDate: toDateStr(e.date),
      recurFreq: e.recur_freq,
      recurUntil: e.recur_until ? toDateStr(e.recur_until) : null,
      isLunar: e.is_lunar,
      lunarMonth: e.lunar_month,
      lunarDay: e.lunar_day,
      lunarLeap: e.lunar_leap,
      notify: e.notify,
    };
  }

  // 구독·예적금·투자계좌 테이블에서 가상 이벤트 수집 (dateFilter 없으면 전체)
  private async virtualEvents(
    userId: number,
    dateFilter?: { gte: Date; lt?: Date },
  ): Promise<CalEventDto[]> {
    const [subs, savings, isaAccounts] = await Promise.all([
      this.prisma.subscription.findMany({
        where: {
          user_id: userId,
          deleted_at: null,
          ...(dateFilter ? { next_payment_date: dateFilter } : {}),
        },
        select: { id: true, name: true, amount: true, currency: true, next_payment_date: true },
      }),
      this.prisma.saving.findMany({
        where: {
          user_id: userId,
          deleted_at: null,
          maturity_date: { not: null, ...(dateFilter ?? {}) },
        },
        select: { id: true, name: true, maturity_date: true },
      }),
      this.prisma.investmentAccount.findMany({
        where: {
          user_id: userId,
          deleted_at: null,
          maturity_date: { not: null, ...(dateFilter ?? {}) },
        },
        select: { id: true, name: true, maturity_date: true },
      }),
    ]);

    const result: CalEventDto[] = [];

    subs.forEach((s) =>
      result.push({
        id: VIRT_OFFSET.subscription + s.id,
        date: toDateStr(s.next_payment_date),
        type: 'pay',
        title:
          s.currency === 'USD'
            ? `${s.name} · $${Number(s.amount).toFixed(2)}`
            : `${s.name} · ${Number(s.amount).toLocaleString('ko-KR')}원`,
        memo: null,
        virtual: true,
        sourceType: 'subscription',
      }),
    );
    savings.forEach((s) => {
      if (!s.maturity_date) return;
      result.push({
        id: VIRT_OFFSET.saving + s.id,
        date: toDateStr(s.maturity_date),
        type: 'due',
        title: `${s.name} 만기`,
        memo: null,
        virtual: true,
        sourceType: 'saving',
      });
    });
    isaAccounts.forEach((a) => {
      if (!a.maturity_date) return;
      result.push({
        id: VIRT_OFFSET.investmentAccount + a.id,
        date: toDateStr(a.maturity_date),
        type: 'due',
        title: `${a.name} 만기`,
        memo: null,
        virtual: true,
        sourceType: 'investmentAccount',
      });
    });

    return result;
  }

  // 일정 목록 — month(YYYY-MM) 지정 시 해당 월만. 실제(반복 발생 포함) + 가상 합산
  async findAll(userId: number, month?: string) {
    const range = month ? monthRange(month) : undefined;
    const where: Prisma.CalendarEventWhereInput = {
      user_id: userId,
      deleted_at: null,
    };
    if (range) {
      where.OR = [
        { recur_freq: 'none', date: range },
        {
          recur_freq: { not: 'none' },
          date: { lt: range.lt },
          OR: [{ recur_until: null }, { recur_until: { gte: range.gte } }],
        },
      ];
    }

    const [rows, virtual, holidays] = await Promise.all([
      this.prisma.calendarEvent.findMany({
        where,
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      }),
      this.virtualEvents(userId, range),
      range ? this.holidaysForRange(userId, range) : Promise.resolve([]),
    ]);

    const expanded = range
      ? rows.flatMap((r) =>
          r.recur_freq === 'none'
            ? [this.toDto(r)]
            : occurrencesInRange(r, range).map((d) => this.toDto(r, d)),
        )
      : rows.map((r) => this.toDto(r));

    return [...expanded, ...virtual, ...holidays].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
    );
  }

  // 사용자가 공휴일 표시를 켰을 때만 해당 범위의 공휴일 DTO 목록 반환
  private async holidaysForRange(
    userId: number,
    range: { gte: Date; lt: Date },
  ): Promise<CalEventDto[]> {
    if (!(await this.showHolidays(userId))) return [];
    const holidays = await this.holidayService.getForRange(range);
    return this.toHolidayDtos(holidays);
  }

  // 다가오는 일정 — 오늘 이후 가까운 순(반복 일정은 다음 발생일 1건). 실제 + 가상 합산 후 limit 적용
  async upcoming(userId: number, limit = 5) {
    const today = todayKst();

    const oneYearLater = new Date(Date.UTC(today.getUTCFullYear() + 1, today.getUTCMonth(), today.getUTCDate()));

    const [rows, virtual, holidays] = await Promise.all([
      this.prisma.calendarEvent.findMany({
        where: {
          user_id: userId,
          deleted_at: null,
          OR: [
            { recur_freq: 'none', date: { gte: today } },
            {
              recur_freq: { not: 'none' },
              OR: [{ recur_until: null }, { recur_until: { gte: today } }],
            },
          ],
        },
        orderBy: { date: 'asc' },
      }),
      this.virtualEvents(userId, { gte: today }),
      this.holidaysForRange(userId, { gte: today, lt: oneYearLater }),
    ]);

    const addDays = (ev: CalEventDto) => ({
      ...ev,
      daysUntil: Math.round(
        (new Date(ev.date).getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
      ),
    });

    const upcomingRows = rows
      .map((r) => {
        const occ =
          r.recur_freq === 'none' ? r.date : nextOccurrenceOnOrAfter(r, today);
        return occ ? this.toDto(r, occ) : null;
      })
      .filter((d): d is CalEventDto => d !== null);

    return [...upcomingRows.map(addDays), ...virtual.map(addDays), ...holidays.map(addDays)]
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
      .slice(0, limit);
  }

  // 입력 날짜(양력, 날짜 선택기로 고른 실제 날짜) → is_lunar면 그 날짜에 해당하는 음력 월/일/윤달여부를 계산해 함께 저장
  // (반대로 "음력 월/일을 입력값으로 해석"하지 않는다 — 음력 30일처럼 존재하지 않는 날을 사용자가 고를 수 있어 매번 실패했음)
  private resolveEventDate(
    date: string,
    isLunar: boolean,
  ): { date: Date; lunarMonth: number | null; lunarDay: number | null; lunarLeap: boolean } {
    const solar = new Date(date);
    if (!isLunar) return { date: solar, lunarMonth: null, lunarDay: null, lunarLeap: false };
    const lunar = solarToLunar(solar);
    if (!lunar) {
      throw new BadRequestException('지원하지 않는 날짜입니다 (음력 변환 가능 범위: 1000~2050년).');
    }
    return { date: solar, lunarMonth: lunar.month, lunarDay: lunar.day, lunarLeap: lunar.intercalation };
  }

  // 추가 DTO → 저장할 행 (음력이면 음력 월/일을 계산해 넣는다)
  private toCreateData(userId: number, dto: CreateEventDto): Prisma.CalendarEventUncheckedCreateInput {
    const isLunar = dto.isLunar ?? false;
    const { date, lunarMonth, lunarDay, lunarLeap } = this.resolveEventDate(dto.date, isLunar);
    return {
      user_id: userId,
      date,
      type: dto.type,
      title: dto.title,
      memo: dto.memo,
      is_lunar: isLunar,
      lunar_month: lunarMonth,
      lunar_day: lunarDay,
      lunar_leap: lunarLeap,
      recur_freq: dto.recurFreq ?? 'none',
      recur_until: dto.recurUntil ? new Date(dto.recurUntil) : null,
      notify: dto.notify ?? false,
    };
  }

  // 일정 추가 (수동 등록만)
  async create(userId: number, dto: CreateEventDto) {
    const created = await this.prisma.calendarEvent.create({ data: this.toCreateData(userId, dto) });
    return this.toDto(created);
  }

  // 일정 일괄 추가 — 한 트랜잭션이라 한 건이라도 실패하면 아무것도 저장되지 않는다
  async bulkCreate(userId: number, dtos: CreateEventDto[]) {
    const data = dtos.map((dto) => this.toCreateData(userId, dto));
    const created = await this.prisma.$transaction(
      data.map((d) => this.prisma.calendarEvent.create({ data: d })),
    );
    return created.map((e) => this.toDto(e));
  }

  // day 에 회차가 있고 알림을 켠 일정 — 매일 오전 9시 알림 작업이 쓴다 (반복 · 음력 회차 포함)
  async notifyTargetsOn(userId: number, day: Date): Promise<{ id: number; type: string; title: string }[]> {
    const range = { gte: day, lt: new Date(day.getTime() + 24 * 60 * 60 * 1000) };
    const rows = await this.prisma.calendarEvent.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        notify: true,
        OR: [
          { recur_freq: 'none', date: range },
          {
            recur_freq: { not: 'none' },
            date: { lt: range.lt },
            OR: [{ recur_until: null }, { recur_until: { gte: range.gte } }],
          },
        ],
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    });
    return rows
      .filter((r) => occurrencesInRange(r, range).length > 0)
      .map((r) => ({ id: r.id, type: r.type, title: r.title }));
  }

  // 본인 소유 + 미삭제 확인
  private async findOwned(userId: number, id: number): Promise<CalendarEvent> {
    const row = await this.prisma.calendarEvent.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('일정을 찾을 수 없습니다.');
    return row;
  }

  // 일정 수정 (수동 등록 이벤트만)
  async update(userId: number, id: number, dto: UpdateEventDto) {
    const existing = await this.findOwned(userId, id);
    const isLunar = dto.isLunar ?? existing.is_lunar;
    // 날짜/음력여부 중 하나라도 바뀌면 음력 월/일/윤달여부를 다시 계산
    const dateChanged = dto.date !== undefined || dto.isLunar !== undefined;
    const resolved = dateChanged
      ? this.resolveEventDate(dto.date ?? toDateStr(existing.date), isLunar)
      : null;
    const updated = await this.prisma.calendarEvent.update({
      where: { id },
      data: {
        date: resolved?.date,
        type: dto.type,
        title: dto.title,
        memo: dto.memo,
        is_lunar: dto.isLunar,
        lunar_month: resolved ? resolved.lunarMonth : undefined,
        lunar_day: resolved ? resolved.lunarDay : undefined,
        lunar_leap: resolved ? resolved.lunarLeap : undefined,
        recur_freq: dto.recurFreq,
        recur_until:
          dto.recurUntil !== undefined
            ? dto.recurUntil
              ? new Date(dto.recurUntil)
              : null
            : undefined,
        notify: dto.notify,
      },
    });
    return this.toDto(updated);
  }

  // 일정 삭제 — 실제 이벤트: soft delete / 가상 이벤트: 원본 테이블 soft delete
  // 반복 일정에서 occurrenceDate(클릭한 회차의 날짜)를 지정하면, 그 날짜 이후 발생만 중단하고
  // 이전 발생들은 유지한다(recur_until을 해당 회차 하루 전으로 설정). 첫 회차를 지정하면 전체 삭제와 동일.
  async remove(userId: number, id: number, occurrenceDate?: string) {
    const virt = decodeVirtId(id);
    if (virt) {
      if (virt.sourceType === 'holiday') {
        throw new BadRequestException('공휴일은 삭제할 수 없습니다.');
      }
      await this.removeVirtual(userId, virt.sourceType, virt.sourceId);
      return { id };
    }
    const existing = await this.findOwned(userId, id);

    if (occurrenceDate && existing.recur_freq !== 'none') {
      const occ = new Date(occurrenceDate);
      if (occ.getTime() > existing.date.getTime()) {
        const until = new Date(occ.getTime() - 24 * 60 * 60 * 1000);
        await this.prisma.calendarEvent.update({
          where: { id },
          data: { recur_until: until },
        });
        return { id };
      }
    }

    await this.prisma.calendarEvent.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { id };
  }

  // 원본 테이블별 soft delete
  private async removeVirtual(
    userId: number,
    sourceType: VirtSource,
    sourceId: number,
  ) {
    const now = new Date();
    switch (sourceType) {
      case 'subscription':
        await this.prisma.subscription.updateMany({
          where: { id: sourceId, user_id: userId },
          data: { deleted_at: now },
        });
        break;
      case 'saving':
        await this.prisma.saving.updateMany({
          where: { id: sourceId, user_id: userId },
          data: { deleted_at: now },
        });
        break;
      case 'investmentAccount':
        // 계좌 자체는 보유 종목이 있으면 삭제가 막혀있으므로(investment-account.service.remove), 여기서는 만기일만 제거
        await this.prisma.investmentAccount.updateMany({
          where: { id: sourceId, user_id: userId },
          data: { maturity_date: null },
        });
        break;
    }
  }
}
