import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HolidayService } from '../holiday/holiday.service';
import { SystemLogService } from '../system-log/system-log.service';

// 매월 1일 새벽 2시 — 올해/내년 공휴일을 미리 캐싱해 사용자가 캘린더를 열 때 외부 API 호출 없이 바로 표시되게 한다.
// HolidayService.getForYear 는 이미 캐시된 연도면 그대로 반환하므로 매번 재요청되지 않는다.
@Injectable()
export class HolidayCronService {
  private readonly logger = new Logger(HolidayCronService.name);

  constructor(
    private holidayService: HolidayService,
    private sysLog: SystemLogService,
  ) {}

  @Cron('0 2 1 * *')
  async prefetch(): Promise<void> {
    const year = new Date().getFullYear();
    try {
      const [thisYear, nextYear] = await Promise.all([
        this.holidayService.getForYear(year),
        this.holidayService.getForYear(year + 1),
      ]);
      this.logger.log(`공휴일 캐시 확인: ${year}년 ${thisYear.length}건, ${year + 1}년 ${nextYear.length}건`);
    } catch (e) {
      this.logger.warn(`공휴일 사전 캐싱 실패: ${(e as Error).message}`);
      this.sysLog.error({ category: 'cron', message: '공휴일 사전 캐싱 실패', metadata: { year, error: (e as Error).message } });
    }
  }
}
