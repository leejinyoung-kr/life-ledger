import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionService } from '../transaction/transaction.service';
import { InvestmentService } from '../investment/investment.service';

// 반복거래/반복매수 회차 일괄 생성 — 조회 시점(lazy)이 아닌 매일 오전 9시에 전체 사용자분을 채운다.
@Injectable()
export class RecurringCronService {
  private readonly logger = new Logger(RecurringCronService.name);

  constructor(
    private prisma: PrismaService,
    private transactionService: TransactionService,
    private investmentService: InvestmentService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async run(): Promise<void> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    let failed = 0;

    for (const u of users) {
      try {
        await this.transactionService.materializeRecurring(u.id);
        await this.investmentService.materializeRecurringBuys(u.id);
      } catch (err) {
        failed += 1;
        this.logger.error(`사용자 ${u.id} 반복거래/반복매수 처리 실패: ${(err as Error).message}`);
      }
    }

    this.logger.log(`반복거래/반복매수 일괄 처리 완료 (사용자 ${users.length}명${failed ? `, 실패 ${failed}건` : ''})`);
  }
}
