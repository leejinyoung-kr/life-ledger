import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HolidayDto {
  date: Date;
  name: string;
  isSubstitute: boolean;
}

// 공공데이터포털 특일 정보(SpcdeInfoService) getRestDeInfo 응답 item — 대체공휴일 포함 관공서 휴일 전체
interface SpcdeItem {
  locdate: number | string; // YYYYMMDD
  dateName: string;
  isHoliday: 'Y' | 'N';
}

@Injectable()
export class HolidayService {
  private readonly logger = new Logger(HolidayService.name);

  constructor(private prisma: PrismaService) {}

  // 조회 범위(연도가 걸쳐도 됨)에 해당하는 공휴일 목록 — 연도별 캐시 우선, 없으면 외부 API에서 가져와 캐싱
  async getForRange(range: { gte: Date; lt: Date }): Promise<HolidayDto[]> {
    const years: number[] = [];
    for (let y = range.gte.getUTCFullYear(); y <= range.lt.getUTCFullYear(); y++) years.push(y);
    const lists = await Promise.all(years.map((y) => this.getForYear(y)));
    return lists
      .flat()
      .filter((h) => h.date >= range.gte && h.date < range.lt);
  }

  // 연도별 공휴일 조회 — DB 캐시가 있으면 그대로, 없으면 API에서 가져와 캐싱 후 반환
  async getForYear(year: number): Promise<HolidayDto[]> {
    const cached = await this.prisma.holiday.findMany({ where: { year } });
    if (cached.length) {
      return cached.map((h) => ({ date: h.date, name: h.name, isSubstitute: h.is_substitute }));
    }
    return this.fetchAndCache(year);
  }

  // 공공데이터포털 API 호출 → DB 캐싱 (키 미설정/API 실패 시 빈 배열 — 캘린더 자체는 정상 동작)
  private async fetchAndCache(year: number): Promise<HolidayDto[]> {
    const apiKey = process.env.HOLIDAY_API_KEY;
    if (!apiKey) return [];
    try {
      const items = await this.fetchFromApi(year, apiKey);
      if (items.length) {
        await this.prisma.holiday.createMany({
          data: items.map((i) => ({
            date: i.date,
            name: i.name,
            is_substitute: i.isSubstitute,
            year,
          })),
          skipDuplicates: true,
        });
      }
      return items;
    } catch (err) {
      this.logger.warn(`${year}년 공휴일 조회 실패: ${(err as Error).message}`);
      return [];
    }
  }

  private async fetchFromApi(year: number, apiKey: string): Promise<HolidayDto[]> {
    const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?solYear=${year}&ServiceKey=${apiKey}&_type=json&numOfRows=100`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const raw = json?.response?.body?.items?.item;
    const list: SpcdeItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return list.map((it) => ({
      date: parseLocdate(it.locdate),
      name: String(it.dateName),
      isSubstitute: String(it.dateName).includes('대체'),
    }));
  }
}

// YYYYMMDD(숫자/문자) → UTC Date
function parseLocdate(locdate: number | string): Date {
  const s = String(locdate);
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  return new Date(Date.UTC(y, m - 1, d));
}
