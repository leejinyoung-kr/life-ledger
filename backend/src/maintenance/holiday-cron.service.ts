import { Injectable } from '@nestjs/common';
import { Job } from '@leejinyoung-kr/core-jobs';
import { HolidayService } from '../holiday/holiday.service';

// 매월 1일 새벽 2시 — 올해/내년 공휴일을 미리 캐싱해 사용자가 캘린더를 열 때 외부 API 호출 없이 바로 표시되게 한다.
// HolidayService.getForYear 는 이미 캐시된 연도면 그대로 반환하므로 매번 재요청되지 않는다.
// 실패는 실행 기록(job_run)과 시스템 로그("예약 작업 실패")에 core-jobs 가 남긴다
@Injectable()
export class HolidayCronService {
  constructor(private holidayService: HolidayService) {}

  @Job({ name: 'holiday-prefetch', cron: '0 2 1 * *', leaseMs: 5 * 60_000 })
  async prefetch(): Promise<string> {
    const year = new Date().getFullYear();
    const [thisYear, nextYear] = await Promise.all([
      this.holidayService.getForYear(year),
      this.holidayService.getForYear(year + 1),
    ]);
    return `공휴일 캐시 확인: ${year}년 ${thisYear.length}건, ${year + 1}년 ${nextYear.length}건`;
  }
}
