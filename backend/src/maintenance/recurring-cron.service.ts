import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionService } from '../transaction/transaction.service';
import { InvestmentService } from '../investment/investment.service';

// 반복거래/반복매수 회차 일괄 생성 — 조회 시점(lazy)이 아닌 매일 정해진 시각에 전체 사용자분을 채운다.
// 해외 반복매수는 미국 장 시작 시각에 맞춰 별도 시간대(밤 11시)에 따로 돌린다(runForeign).
@Injectable()
export class RecurringCronService {
  private readonly logger = new Logger(RecurringCronService.name);

  constructor(
    private prisma: PrismaService,
    private transactionService: TransactionService,
    private investmentService: InvestmentService,
  ) {}

  // 반복거래 + 반복매수(국내) — 매일 오전 9시
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async run(): Promise<void> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    let failed = 0;

    for (const u of users) {
      try {
        await this.transactionService.materializeRecurring(u.id);
        await this.investmentService.materializeRecurringBuys(u.id, 'domestic');
      } catch (err) {
        failed += 1;
        this.logger.error(`사용자 ${u.id} 반복거래/반복매수(국내) 처리 실패: ${(err as Error).message}`);
      }
    }

    this.logger.log(`반복거래/반복매수(국내) 일괄 처리 완료 (사용자 ${users.length}명${failed ? `, 실패 ${failed}건` : ''})`);
  }

  // 반복매수(해외) — 미국 장이 열린 직후인 밤 11시(KST)에 돌려, 전날 종가에 고정된 가격이 아닌
  // 그 시점 실시간(장중) 가격으로 매수하도록 국내 배치와 시간을 분리한다.
  @Cron('0 23 * * *')
  async runForeign(): Promise<void> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    let failed = 0;

    for (const u of users) {
      try {
        await this.investmentService.materializeRecurringBuys(u.id, 'foreign');
      } catch (err) {
        failed += 1;
        this.logger.error(`사용자 ${u.id} 반복매수(해외) 처리 실패: ${(err as Error).message}`);
      }
    }

    this.logger.log(`반복매수(해외) 일괄 처리 완료 (사용자 ${users.length}명${failed ? `, 실패 ${failed}건` : ''})`);
  }
}
