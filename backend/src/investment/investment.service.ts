import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Investment, InvestmentType, Prisma, RecurringSchedule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parsePage } from '@leejinyoung-kr/core-common';
import { RRule, periodOf, nthOccurrence } from '../transaction/recurring.util';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { QueryInvestmentDto } from './dto/query-investment.dto';
import { UpdateInvestmentDto } from './dto/update-investment.dto';
import { TradeInvestmentDto } from './dto/trade-investment.dto';
import { FOREIGN_TYPES, PriceLookupService } from './price-lookup.service';
import { SystemLogService } from '../system-log/system-log.service';

// 반복매수 일괄 처리 시 외부 시세조회 API 과다호출 방지용 묶음 크기/대기시간
const RECURRING_BUY_BATCH_SIZE = 3;
const RECURRING_BUY_BATCH_DELAY_MS = 3000;

// 현재가 갱신 배치 — 반복매수보다 단순(조회 후 update만)하므로 묶음 크기를 약간 크게 잡는다
const PRICE_REFRESH_BATCH_SIZE = 5;
const PRICE_REFRESH_BATCH_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class InvestmentService {
  constructor(
    private prisma: PrismaService,
    private priceLookup: PriceLookupService,
    private sysLog: SystemLogService,
  ) {}

  // 엔티티 → 응답 DTO (수익/수익률 파생값 포함). 예수금은 종목이 아닌 소속 계좌(InvestmentAccount)가 보유
  private toDto(v: Investment) {
    const principal = v.principal.toNumber();
    const currentValue = v.current_value.toNumber();
    const profit = currentValue - principal;
    return {
      id: v.id,
      accountId: v.account_id,
      name: v.name,
      type: v.type,
      symbol: v.symbol,
      quantity: v.quantity ? v.quantity.toNumber() : null,
      principal,
      principalUsd: v.principal_usd ? v.principal_usd.toNumber() : null,
      currentValue,
      currentValueUsd: v.current_value_usd ? v.current_value_usd.toNumber() : null,
      profit,
      profitRate: principal ? Math.round((profit / principal) * 1000) / 10 : 0,
      purchaseDate: v.purchase_date ? v.purchase_date.toISOString().slice(0, 10) : null,
      memo: v.memo,
      // 평가금액 최근 수정 시각 — 시세 API 연동 전까지는 수동 입력이라 신뢰도 가늠용으로 노출
      updatedAt: v.updated_at.toISOString(),
    };
  }

  // symbol 필수 확인 — 직접 단가 입력이 없을 때 시세조회에 필요
  private requireSymbol(row: Investment): string {
    if (!row.symbol) throw new BadRequestException('종목코드/티커가 없는 종목은 단가를 직접 입력해야 합니다.');
    return row.symbol;
  }

  // 매수/매도 금액 결정 — 해외종목(foreign_stock/foreign_etf)은 단가를 달러로 다루고 cash_balance_usd와 연동,
  // 국내종목은 단가를 원화로 다룬다. principal/current_value 집계는 항상 원화 기준이라 krwAmount를 함께 반환
  private async resolveTradeAmount(
    row: Investment,
    quantity: number,
    manualPrice?: number,
  ): Promise<{ isForeign: boolean; amount: Prisma.Decimal; krwAmount: Prisma.Decimal }> {
    const isForeign = FOREIGN_TYPES.includes(row.type);
    if (!isForeign) {
      const price = manualPrice !== undefined
        ? new Prisma.Decimal(manualPrice)
        : new Prisma.Decimal((await this.priceLookup.lookup(row.type, this.requireSymbol(row))).krwPrice);
      const amount = new Prisma.Decimal(quantity).mul(price);
      return { isForeign, amount, krwAmount: amount };
    }
    let unitNative: Prisma.Decimal;
    let unitKrw: Prisma.Decimal;
    if (manualPrice !== undefined) {
      unitNative = new Prisma.Decimal(manualPrice);
      unitKrw = unitNative.mul(await this.priceLookup.getExchangeRate('USD', 'KRW'));
    } else {
      const r = await this.priceLookup.lookup(row.type, this.requireSymbol(row));
      unitNative = new Prisma.Decimal(r.price);
      unitKrw = new Prisma.Decimal(r.krwPrice);
    }
    const amount = new Prisma.Decimal(quantity).mul(unitNative);
    const krwAmount = new Prisma.Decimal(quantity).mul(unitKrw);
    return { isForeign, amount, krwAmount };
  }

  // 활성 종목(symbol + quantity 보유)의 current_value 를 현재 시세로 갱신.
  // 수량 × 현재가(원화)로 재계산 — 외부 API 과다호출 방지를 위해 PRICE_REFRESH_BATCH_SIZE 개씩 배치 처리.
  async refreshCurrentValues(userId: number, market?: 'domestic' | 'foreign'): Promise<void> {
    const rows = await this.prisma.investment.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        symbol: { not: null },
        quantity: { not: null },
        type: market === 'foreign' ? { in: FOREIGN_TYPES } : market === 'domestic' ? { notIn: FOREIGN_TYPES } : undefined,
      },
    });
    if (!rows.length) return;

    let updated = 0;
    for (let i = 0; i < rows.length; i += PRICE_REFRESH_BATCH_SIZE) {
      const batch = rows.slice(i, i + PRICE_REFRESH_BATCH_SIZE);
      await Promise.all(batch.map(async (inv) => {
        try {
          const r = await this.priceLookup.lookup(inv.type, inv.symbol!);
          const newValue = inv.quantity!.mul(new Prisma.Decimal(r.krwPrice));
          const isForeign = FOREIGN_TYPES.includes(inv.type);
          await this.prisma.investment.update({
            where: { id: inv.id },
            data: {
              current_value: newValue,
              current_value_usd: isForeign ? inv.quantity!.mul(new Prisma.Decimal(r.price)) : undefined,
            },
          });
          updated++;
        } catch (e) {
          this.sysLog.warn({
            userId,
            category: 'asset',
            message: `${inv.symbol} 현재가 갱신 실패`,
            metadata: { investmentId: inv.id, symbol: inv.symbol, type: inv.type, error: (e as Error).message },
          });
        }
      }));
      if (i + PRICE_REFRESH_BATCH_SIZE < rows.length) await sleep(PRICE_REFRESH_BATCH_DELAY_MS);
    }

    if (updated > 0) {
      this.sysLog.info({
        userId,
        category: 'asset',
        message: `투자 종목 현재가 갱신 완료 (${updated}/${rows.length}건)`,
        metadata: { updated, total: rows.length },
      });
    }
  }

  // 반복매수(주식모으기) — 활성화된 자동이체 설정(RecurringSchedule, kind=investment)의 미처리 회차를
  // 그 시점 실시간 시세로 매수 처리. RecurringCronService가 국내는 매일 오전 9시, 해외는 미국 장이 열린
  // 직후인 밤 11시에 호출(조회 시점에는 호출하지 않음).
  // market 지정 시 국내(domestic)/해외(foreign) 중 한쪽만 대상으로 필터링 — 해외는 장 시작 전(오전 9시)에 돌리면
  // 전날 종가로 굳어있는 가격에 매수하게 되므로 시간을 분리해야 한다.
  // 종목별로 외부 시세조회 API(네이버/야후)를 호출하므로, 한꺼번에 몰아치지 않도록 RECURRING_BUY_BATCH_SIZE개씩 묶어
  // RECURRING_BUY_BATCH_DELAY_MS만큼 쉬어가며 처리한다.
  async materializeRecurringBuys(userId: number, market?: 'domestic' | 'foreign'): Promise<number> {
    const schedules = await this.prisma.recurringSchedule.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        kind: 'investment',
        active: true,
        investment: {
          deleted_at: null,
          type: market === 'foreign' ? { in: FOREIGN_TYPES } : market === 'domestic' ? { notIn: FOREIGN_TYPES } : undefined,
        },
      },
      include: { investment: true },
    });
    if (!schedules.length) return 0;
    const now = new Date();

    for (let i = 0; i < schedules.length; i += RECURRING_BUY_BATCH_SIZE) {
      const batch = schedules.slice(i, i + RECURRING_BUY_BATCH_SIZE);
      await Promise.all(batch.map((s) => this.materializeOneRecurringBuy(userId, s, now)));
      if (i + RECURRING_BUY_BATCH_SIZE < schedules.length) await sleep(RECURRING_BUY_BATCH_DELAY_MS);
    }
    return schedules.length;
  }

  // 스케줄 1개의 미처리 회차를 끝까지(또는 실패할 때까지) 처리 — materializeRecurringBuys의 배치 단위 작업
  private async materializeOneRecurringBuy(
    userId: number,
    schedule: RecurringSchedule & { investment: Investment | null },
    now: Date,
  ): Promise<void> {
    const inv = schedule.investment;
    if (!inv || inv.deleted_at) return;
    const rule = schedule.rule as unknown as RRule | null;
    if (!rule?.cycle || (!schedule.buy_amount && !schedule.buy_quantity) || !inv.symbol) return;
    const isForeign = FOREIGN_TYPES.includes(inv.type);

    let lastPeriod = schedule.last_period;
    let quantity = inv.quantity;

    for (let i = 0; i <= 120; i++) { // 안전 상한 — 10년치 월간 회차
      const occ = nthOccurrence(schedule.start_date, rule, i);
      if (occ > now) break;
      if (occ < schedule.start_date) continue; // 시작일 이전 회차(연간 i=0이 시작월보다 이른 달인 경우)는 매수하지 않음
      const period = periodOf(occ, rule.cycle);
      if (lastPeriod && period <= lastPeriod) continue;

      let unitNative: Prisma.Decimal;
      let unitKrw: Prisma.Decimal;
      try {
        const r = await this.priceLookup.lookup(inv.type, inv.symbol);
        unitNative = new Prisma.Decimal(r.price);
        unitKrw = new Prisma.Decimal(r.krwPrice);
      } catch (e) {
        this.sysLog.warn({
          userId,
          category: 'recurring_buy',
          message: `${inv.symbol} 시세 조회 실패 — 다음 배치에 재시도`,
          metadata: { investmentId: inv.id, symbol: inv.symbol, type: inv.type, period, error: (e as Error).message },
        });
        break;
      }
      // 수량 모드(n주): 매 회차 시세 × n주로 매수. 금액 모드: 고정 금액(국내 원/해외 달러)을 그 시점 단가로 나눠 수량 계산
      const qtyDelta = schedule.buy_quantity
        ? schedule.buy_quantity
        : schedule.buy_amount!.div(unitNative);
      const nativeAmount = schedule.buy_quantity ? qtyDelta.mul(unitNative) : schedule.buy_amount!;
      const krwAmount = qtyDelta.mul(unitKrw);

      let applied: boolean;
      try {
        applied = await this.prisma.$transaction(async (tx) => {
          const account = await tx.investmentAccount.findFirst({
            where: { id: inv.account_id, user_id: userId, deleted_at: null },
          });
          if (!account) return false;
          const balance = isForeign ? account.cash_balance_usd : account.cash_balance;
          if (balance.lessThan(nativeAmount)) return false;
          await tx.investmentAccount.update({
            where: { id: account.id },
            data: isForeign ? { cash_balance_usd: { decrement: nativeAmount } } : { cash_balance: { decrement: nativeAmount } },
          });
          await tx.investment.update({
            where: { id: inv.id },
            data: {
              principal: { increment: krwAmount },
              ...(isForeign ? { principal_usd: { increment: nativeAmount } } : {}),
              current_value: { increment: krwAmount },
              ...(isForeign ? { current_value_usd: { increment: nativeAmount } } : {}),
              quantity: quantity ? { increment: qtyDelta } : qtyDelta,
            },
          });
          await tx.recurringSchedule.update({ where: { id: schedule.id }, data: { last_period: period } });
          return true;
        });
      } catch (e) {
        this.sysLog.error({
          userId,
          category: 'recurring_buy',
          message: `${inv.symbol} 반복매수 DB 처리 충돌 — 다음 배치에 재시도`,
          metadata: { investmentId: inv.id, symbol: inv.symbol, type: inv.type, period, error: (e as Error).message },
        });
        break;
      }
      if (!applied) {
        this.sysLog.warn({
          userId,
          category: 'recurring_buy',
          message: `${inv.symbol} 반복매수 예수금 부족 — 충전 후 재시도`,
          metadata: { investmentId: inv.id, symbol: inv.symbol, type: inv.type, period, required: nativeAmount.toFixed(4), currency: isForeign ? 'USD' : 'KRW' },
        });
        break;
      }
      this.sysLog.info({
        userId,
        category: 'recurring_buy',
        message: `${inv.symbol} 반복매수 ${period} 회차 처리 완료`,
        metadata: { investmentId: inv.id, symbol: inv.symbol, type: inv.type, period, quantity: qtyDelta.toFixed(6), amountKrw: krwAmount.toFixed(0) },
      });
      lastPeriod = period;
      quantity = quantity ? quantity.add(qtyDelta) : qtyDelta;
    }
  }

  // 본인 소유 + 미삭제 계좌인지 확인
  private async findOwnedAccount(userId: number, accountId: number) {
    const account = await this.prisma.investmentAccount.findFirst({
      where: { id: accountId, user_id: userId, deleted_at: null },
    });
    if (!account) throw new BadRequestException('소속 투자 계좌를 찾을 수 없습니다.');
    return account;
  }

  // 투자 목록 — 유형/종목명/계좌 필터. page 지정 시 서버 페이징, 없으면 전체 배열
  async findAll(userId: number, query: QueryInvestmentDto = {}) {
    const where: Prisma.InvestmentWhereInput = { user_id: userId, deleted_at: null };
    if (query.type) where.type = query.type;
    if (query.q) where.name = { contains: query.q };
    if (query.accountId) where.account_id = Number(query.accountId);
    const orderBy: Prisma.InvestmentOrderByWithRelationInput = { created_at: 'desc' };

    const pg = parsePage(query.page, query.limit);
    if (pg) {
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.investment.findMany({ where, orderBy, skip: pg.skip, take: pg.take }),
        this.prisma.investment.count({ where }),
      ]);
      return { items: rows.map((r) => this.toDto(r)), total, page: pg.page, limit: pg.limit };
    }

    const rows = await this.prisma.investment.findMany({ where, orderBy });
    return rows.map((r) => this.toDto(r));
  }

  // 현재 USD/KRW 환율 조회 — 해외투자 USD 표기 토글에 사용
  async getExchangeRate() {
    const rate = await this.priceLookup.getExchangeRate('USD', 'KRW');
    return { rate };
  }

  // 요약 — 총 평가금액 / 총 원금 / 총 수익 / 수익률
  async summary(userId: number) {
    const rows = await this.prisma.investment.findMany({
      where: { user_id: userId, deleted_at: null },
    });
    const totalValue = rows.reduce((s, r) => s + r.current_value.toNumber(), 0);
    const totalPrincipal = rows.reduce((s, r) => s + r.principal.toNumber(), 0);
    const totalProfit = totalValue - totalPrincipal;
    return {
      totalValue,
      totalPrincipal,
      totalProfit,
      profitRate: totalPrincipal ? Math.round((totalProfit / totalPrincipal) * 1000) / 10 : 0,
    };
  }

  // 반복매수 활성화 시 시세조회/회차계산에 필요한 값(종목코드·회차금액·규칙·최초매수일)이 모두 있는지 확인
  // 투자원금/평가금액 입력값 → 원화 환산 — 해외종목(foreign_stock/foreign_etf)은 폼에서 달러로 입력받으므로
  // 실시간 환율로 원화 변환해 저장(principal/current_value는 항상 원화 기준으로 전체 자산 집계와 맞춤)
  private async toKrwAmount(type: InvestmentType, value: number): Promise<Prisma.Decimal> {
    if (!FOREIGN_TYPES.includes(type)) return new Prisma.Decimal(value);
    const rate = await this.priceLookup.getExchangeRate('USD', 'KRW');
    return new Prisma.Decimal(value).mul(rate);
  }

  // 투자 추가 — 소속 계좌(accountId) 필수
  async create(userId: number, dto: CreateInvestmentDto) {
    await this.findOwnedAccount(userId, dto.accountId);
    const [principal, currentValue] = await Promise.all([
      this.toKrwAmount(dto.type, dto.principal),
      this.toKrwAmount(dto.type, dto.currentValue),
    ]);
    const created = await this.prisma.investment.create({
      data: {
        user_id: userId,
        account_id: dto.accountId,
        name: dto.name,
        type: dto.type,
        symbol: dto.symbol,
        quantity: dto.quantity !== undefined ? new Prisma.Decimal(dto.quantity) : undefined,
        principal,
        principal_usd: FOREIGN_TYPES.includes(dto.type) ? new Prisma.Decimal(dto.principal) : null,
        current_value: currentValue,
        current_value_usd: FOREIGN_TYPES.includes(dto.type) ? new Prisma.Decimal(dto.currentValue) : null,
        purchase_date: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        memo: dto.memo,
      },
    });
    return this.toDto(created);
  }

  // 본인 소유 + 미삭제 확인
  private async findOwned(userId: number, id: number): Promise<Investment> {
    const row = await this.prisma.investment.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('투자 항목을 찾을 수 없습니다.');
    return row;
  }

  // 투자 수정
  async update(userId: number, id: number, dto: UpdateInvestmentDto) {
    const existing = await this.findOwned(userId, id);
    if (dto.accountId !== undefined) await this.findOwnedAccount(userId, dto.accountId);
    const type = dto.type ?? existing.type;
    const [principal, currentValue] = await Promise.all([
      dto.principal !== undefined ? this.toKrwAmount(type, dto.principal) : undefined,
      dto.currentValue !== undefined ? this.toKrwAmount(type, dto.currentValue) : undefined,
    ]);
    const updated = await this.prisma.investment.update({
      where: { id },
      data: {
        account_id: dto.accountId,
        name: dto.name,
        type: dto.type,
        symbol: dto.symbol,
        quantity: dto.quantity !== undefined ? new Prisma.Decimal(dto.quantity) : undefined,
        principal,
        principal_usd: dto.principal !== undefined && FOREIGN_TYPES.includes(type)
          ? new Prisma.Decimal(dto.principal)
          : undefined,
        current_value: currentValue,
        current_value_usd: dto.currentValue !== undefined && FOREIGN_TYPES.includes(type)
          ? new Prisma.Decimal(dto.currentValue)
          : undefined,
        purchase_date: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        memo: dto.memo,
      },
    });
    return this.toDto(updated);
  }

  // 시세조회 — 등록된 symbol(종목코드/티커)로 현재가 조회 후 저장된 quantity(보유수량)와 곱해 평가금액 산출
  async lookupPrice(userId: number, id: number) {
    const row = await this.findOwned(userId, id);
    if (!row.symbol) throw new BadRequestException('종목코드/티커가 등록되지 않았습니다.');
    if (!row.quantity) throw new BadRequestException('보유수량이 등록되지 않았습니다. 수정에서 입력해주세요.');
    const result = await this.priceLookup.lookup(row.type, row.symbol);
    const quantity = row.quantity.toNumber();
    return { ...result, quantity, evaluatedValue: Math.round(result.krwPrice * quantity) };
  }

  // 시세조회(단가만) — 매수/매도 모달에서 보유수량과 무관하게 현재 단가만 필요할 때 사용
  async quote(userId: number, id: number) {
    const row = await this.findOwned(userId, id);
    if (!row.symbol) throw new BadRequestException('종목코드/티커가 등록되지 않았습니다.');
    return this.priceLookup.lookup(row.type, row.symbol);
  }

  // 매수 — 수량×단가(직접입력 또는 시세조회)만큼 예수금을 깎아 투자원금·평가금액·보유수량에 반영.
  // 해외종목은 단가를 달러로 다루며 cash_balance_usd에서 차감, principal/current_value는 원화 환산값(krwAmount)으로 누적
  async buy(userId: number, id: number, dto: TradeInvestmentDto) {
    const row = await this.findOwned(userId, id);
    const { isForeign, amount, krwAmount } = await this.resolveTradeAmount(row, dto.quantity, dto.price);
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.investmentAccount.findFirst({
        where: { id: row.account_id, user_id: userId, deleted_at: null },
      });
      if (!account) throw new BadRequestException('소속 투자 계좌를 찾을 수 없습니다.');
      const balance = isForeign ? account.cash_balance_usd : account.cash_balance;
      if (balance.lessThan(amount)) {
        throw new BadRequestException(isForeign ? '달러 예수금이 부족합니다.' : '예수금이 부족합니다.');
      }
      await tx.investmentAccount.update({
        where: { id: account.id },
        data: isForeign ? { cash_balance_usd: { decrement: amount } } : { cash_balance: { decrement: amount } },
      });
      const updated = await tx.investment.update({
        where: { id },
        data: {
          principal: { increment: krwAmount },
          ...(isForeign ? { principal_usd: { increment: amount } } : {}),
          current_value: { increment: krwAmount },
          ...(isForeign ? { current_value_usd: { increment: amount } } : {}),
          quantity: row.quantity ? { increment: dto.quantity } : new Prisma.Decimal(dto.quantity),
        },
      });
      return this.toDto(updated);
    });
  }

  // 매도 — 보유수량에서 매도수량을 차감하고, 수량×단가만큼 평가금액을 줄여 예수금으로 환입.
  // 원금은 평균단가 기준으로 판 수량만큼 줄인다 — 그대로 두면 이익을 보고 팔아도 남은 평가금액이 원금보다 작아져 손실로 보인다(전량 매도 시 -100%).
  // 해외종목은 환입액이 달러로 cash_balance_usd에 들어가며, current_value 차감은 원화 환산값(krwAmount) 기준
  async sell(userId: number, id: number, dto: TradeInvestmentDto) {
    const row = await this.findOwned(userId, id);
    if (!row.quantity || row.quantity.lessThan(dto.quantity)) {
      throw new BadRequestException('보유수량이 부족합니다.');
    }
    const { isForeign, amount, krwAmount } = await this.resolveTradeAmount(row, dto.quantity, dto.price);
    const newCurrentValue = row.current_value.greaterThan(krwAmount)
      ? row.current_value.sub(krwAmount)
      : new Prisma.Decimal(0);
    const newCurrentValueUsd = isForeign && row.current_value_usd
      ? (row.current_value_usd.greaterThan(amount) ? row.current_value_usd.sub(amount) : new Prisma.Decimal(0))
      : undefined;
    // 남는 비율 = (보유 − 매도) / 보유. 전량 매도면 원금 0
    const keep = row.quantity.sub(dto.quantity).div(row.quantity);
    const newPrincipal = row.principal.mul(keep).toDecimalPlaces(0);
    const newPrincipalUsd = row.principal_usd ? row.principal_usd.mul(keep).toDecimalPlaces(4) : undefined;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.investment.update({
        where: { id },
        data: {
          principal: newPrincipal,
          principal_usd: newPrincipalUsd,
          current_value: newCurrentValue,
          current_value_usd: newCurrentValueUsd,
          quantity: { decrement: dto.quantity },
        },
      });
      await tx.investmentAccount.update({
        where: { id: row.account_id },
        data: isForeign ? { cash_balance_usd: { increment: amount } } : { cash_balance: { increment: amount } },
      });
      return this.toDto(updated);
    });
  }

  // 투자 삭제 (soft delete)
  async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await this.prisma.investment.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { id };
  }

  // 투자 일괄 삭제 (soft delete)
  async removeMany(userId: number, ids: number[]) {
    if (!ids.length) throw new BadRequestException('삭제할 항목이 없습니다.');
    const { count } = await this.prisma.investment.updateMany({
      where: { id: { in: ids }, user_id: userId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    return { count };
  }
}
