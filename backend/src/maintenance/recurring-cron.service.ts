import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionService } from '../transaction/transaction.service';
import { InvestmentService } from '../investment/investment.service';
import { SystemLogService } from '../system-log/system-log.service';

// 반복거래/반복매수 회차 일괄 생성 — 조회 시점(lazy)이 아닌 매일 정해진 시각에 전체 사용자분을 채운다.
// 해외 반복매수는 미국 장 시작 시각에 맞춰 별도 시간대(밤 11시)에 따로 돌린다(runForeign).
@Injectable()
export class RecurringCronService {
  private readonly logger = new Logger(RecurringCronService.name);

  constructor(
    private prisma: PrismaService,
    private transactionService: TransactionService,
    private investmentService: InvestmentService,
    private sysLog: SystemLogService,
  ) {}

  // 실제 증권시장은 평일에만 열리므로 KST 기준 토/일요일에는 매수·현재가 갱신을 건너뛴다
  private isWeekdayKST(): boolean {
    const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(new Date());
    return day !== 'Sat' && day !== 'Sun';
  }

  // 반복거래 + 반복매수(국내) — 매일 오전 9시 (반복매수/현재가 갱신은 평일에만 실행)
  // 반복거래와 반복매수(국내)는 서로 독립적으로 켜고 끌 수 있으므로, 요약 로그도 각자 처리 건수 기준으로 따로 남긴다.
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async run(): Promise<void> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    const weekday = this.isWeekdayKST();
    let txCount = 0;
    let txFailed = 0;
    let buyCount = 0;
    let buyFailed = 0;

    for (const u of users) {
      try {
        txCount += await this.transactionService.materializeRecurring(u.id);
      } catch (err) {
        txFailed += 1;
        this.logger.error(`사용자 ${u.id} 반복거래 처리 실패: ${(err as Error).message}`);
        this.sysLog.error({
          userId: u.id,
          category: 'cron',
          message: `반복거래 처리 실패`,
          metadata: { error: (err as Error).message },
        });
      }

      if (!weekday) continue;

      try {
        buyCount += await this.investmentService.materializeRecurringBuys(u.id, 'domestic');
        await this.investmentService.refreshCurrentValues(u.id, 'domestic');
      } catch (err) {
        buyFailed += 1;
        this.logger.error(`사용자 ${u.id} 반복매수(국내) 처리 실패: ${(err as Error).message}`);
        this.sysLog.error({
          userId: u.id,
          category: 'cron',
          message: `반복매수(국내) 처리 실패`,
          metadata: { error: (err as Error).message },
        });
      }
    }

    if (txCount || txFailed) {
      const summary = `반복거래 일괄 처리 완료 (사용자 ${users.length}명${txFailed ? `, 실패 ${txFailed}건` : ''})`;
      this.logger.log(summary);
      this.sysLog.info({
        category: 'cron',
        message: summary,
        metadata: { total: users.length, failed: txFailed },
      });
    }

    if (weekday && (buyCount || buyFailed)) {
      const summary = `반복매수(국내) 일괄 처리 완료 (사용자 ${users.length}명${buyFailed ? `, 실패 ${buyFailed}건` : ''})`;
      this.logger.log(summary);
      this.sysLog.info({
        category: 'cron',
        message: summary,
        metadata: { total: users.length, failed: buyFailed },
      });
    }
  }

  // 반복매수(해외) — 미국 장이 열린 직후인 밤 11시(KST)에 돌려, 전날 종가에 고정된 가격이 아닌
  // 그 시점 실시간(장중) 가격으로 매수하도록 국내 배치와 시간을 분리한다. 주말(KST)에는 건너뛴다.
  @Cron('0 23 * * *')
  async runForeign(): Promise<void> {
    if (!this.isWeekdayKST()) return; // 주말은 장이 열리지 않아 애초에 처리할 게 없으므로 로그 없이 조용히 건너뛴다

    const users = await this.prisma.user.findMany({ select: { id: true } });
    let failed = 0;
    let recurringCount = 0; // 활성 해외 반복매수 항목 수 — 0건이면 요약 로그를 남기지 않는다(불필요한 로그 방지)

    for (const u of users) {
      try {
        recurringCount += await this.investmentService.materializeRecurringBuys(u.id, 'foreign');
        await this.investmentService.refreshCurrentValues(u.id, 'foreign');
      } catch (err) {
        failed += 1;
        this.logger.error(`사용자 ${u.id} 반복매수(해외) 처리 실패: ${(err as Error).message}`);
        this.sysLog.error({
          userId: u.id,
          category: 'cron',
          message: `반복매수(해외) 처리 실패`,
          metadata: { error: (err as Error).message },
        });
      }
    }

    if (!recurringCount && !failed) return;

    const summary = `반복매수(해외) 일괄 처리 완료 (사용자 ${users.length}명${failed ? `, 실패 ${failed}건` : ''})`;
    this.logger.log(summary);
    this.sysLog.info({
      category: 'cron',
      message: summary,
      metadata: { total: users.length, failed },
    });
  }
}
