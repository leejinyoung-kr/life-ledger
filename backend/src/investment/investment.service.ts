import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Investment, InvestmentType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parsePage } from '../common/pagination';
import { RRule, periodOf, nthOccurrence } from '../transaction/recurring.util';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { QueryInvestmentDto } from './dto/query-investment.dto';
import { UpdateInvestmentDto } from './dto/update-investment.dto';
import { TradeInvestmentDto } from './dto/trade-investment.dto';
import { FOREIGN_TYPES, PriceLookupService } from './price-lookup.service';

// 반복매수 일괄 처리 시 외부 시세조회 API 과다호출 방지용 묶음 크기/대기시간
const RECURRING_BUY_BATCH_SIZE = 3;
const RECURRING_BUY_BATCH_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class InvestmentService {
  constructor(
    private prisma: PrismaService,
    private priceLookup: PriceLookupService,
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
      profit,
      profitRate: principal ? Math.round((profit / principal) * 1000) / 10 : 0,
      purchaseDate: v.purchase_date ? v.purchase_date.toISOString().slice(0, 10) : null,
      memo: v.memo,
      recurringBuyEnabled: v.recurring_buy_enabled,
      recurringBuyRule: v.recurring_buy_rule as Record<string, unknown> | null,
      recurringBuyAmount: v.recurring_buy_amount ? v.recurring_buy_amount.toNumber() : null,
      recurringBuyQuantity: v.recurring_buy_quantity ? v.recurring_buy_quantity.toNumber() : null,
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

  // 반복매수(주식모으기) — 활성화된 종목의 미처리 회차를 그 시점 실시간 시세로 매수 처리.
  // RecurringCronService가 국내는 매일 오전 9시, 해외는 미국 장이 열린 직후인 밤 11시에 호출(조회 시점에는 호출하지 않음).
  // market 지정 시 국내(domestic)/해외(foreign) 중 한쪽만 대상으로 필터링 — 해외는 장 시작 전(오전 9시)에 돌리면
  // 전날 종가로 굳어있는 가격에 매수하게 되므로 시간을 분리해야 한다.
  // 종목별로 외부 시세조회 API(네이버/야후)를 호출하므로, 한꺼번에 몰아치지 않도록 RECURRING_BUY_BATCH_SIZE개씩 묶어
  // RECURRING_BUY_BATCH_DELAY_MS만큼 쉬어가며 처리한다.
  async materializeRecurringBuys(userId: number, market?: 'domestic' | 'foreign'): Promise<void> {
    const rows = await this.prisma.investment.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        recurring_buy_enabled: true,
        type: market === 'foreign' ? { in: FOREIGN_TYPES } : market === 'domestic' ? { notIn: FOREIGN_TYPES } : undefined,
      },
    });
    if (!rows.length) return;
    const now = new Date();

    for (let i = 0; i < rows.length; i += RECURRING_BUY_BATCH_SIZE) {
      const batch = rows.slice(i, i + RECURRING_BUY_BATCH_SIZE);
      await Promise.all(batch.map((inv) => this.materializeOneRecurringBuy(userId, inv, now)));
      if (i + RECURRING_BUY_BATCH_SIZE < rows.length) await sleep(RECURRING_BUY_BATCH_DELAY_MS);
    }
  }

  // 종목 1개의 미처리 회차를 끝까지(또는 실패할 때까지) 처리 — materializeRecurringBuys의 배치 단위 작업
  private async materializeOneRecurringBuy(userId: number, inv: Investment, now: Date): Promise<void> {
    const rule = inv.recurring_buy_rule as unknown as RRule | null;
    if (!rule?.cycle || (!inv.recurring_buy_amount && !inv.recurring_buy_quantity) || !inv.purchase_date || !inv.symbol) return;
    const isForeign = FOREIGN_TYPES.includes(inv.type);

    let lastPeriod = inv.recurring_buy_last_period;
    let quantity = inv.quantity;

    // monthly: i=0은 lastPeriod(현재 달)에 막히므로 1부터 시작해 루프 한 번 줄임
    // 나머지 주기(weekly/daily/yearly)는 i=0이 첫 유효 회차 — lastPeriod 중복 체크로 소급 방지
    const startI = rule.cycle === 'monthly' ? 1 : 0;
    for (let i = startI; i <= 120; i++) { // 안전 상한 — 10년치 월간 회차
      const occ = nthOccurrence(inv.purchase_date, rule, i);
      if (occ > now) break;
      if (occ < inv.purchase_date) continue; // 매수 시작일 이전 회차(연간 i=0이 시작월보다 이른 달인 경우)는 매수하지 않음
      const period = periodOf(occ, rule.cycle);
      if (lastPeriod && period <= lastPeriod) continue;

      let unitNative: Prisma.Decimal;
      let unitKrw: Prisma.Decimal;
      try {
        const r = await this.priceLookup.lookup(inv.type, inv.symbol);
        unitNative = new Prisma.Decimal(r.price);
        unitKrw = new Prisma.Decimal(r.krwPrice);
      } catch {
        break; // 시세조회 실패 — 다음 방문 때 이 회차부터 재시도
      }
      // 수량 모드(n주): 매 회차 시세 × n주로 매수. 금액 모드: 고정 금액(국내 원/해외 달러)을 그 시점 단가로 나눠 수량 계산
      const qtyDelta = inv.recurring_buy_quantity
        ? inv.recurring_buy_quantity
        : inv.recurring_buy_amount!.div(unitNative);
      const nativeAmount = inv.recurring_buy_quantity ? qtyDelta.mul(unitNative) : inv.recurring_buy_amount!;
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
              quantity: quantity ? { increment: qtyDelta } : qtyDelta,
              recurring_buy_last_period: period,
            },
          });
          return true;
        });
      } catch {
        break; // 목록/요약 동시 조회로 같은 계좌 행을 동시에 갱신해 충돌난 경우 — 다음 방문 때 이 회차부터 재시도
      }
      if (!applied) break; // 예수금 부족 — 충전 후 다음 방문에 이 회차부터 재시도
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
  private validateRecurringBuy(
    dto: {
      recurringBuyEnabled?: boolean;
      symbol?: string;
      recurringBuyAmount?: number;
      recurringBuyQuantity?: number;
      recurringBuyRule?: Record<string, unknown>;
      purchaseDate?: string;
    },
    existing?: Investment,
  ): void {
    if (!dto.recurringBuyEnabled) return;
    const symbol = dto.symbol ?? existing?.symbol;
    const amount = dto.recurringBuyAmount ?? existing?.recurring_buy_amount?.toNumber();
    const quantity = dto.recurringBuyQuantity ?? existing?.recurring_buy_quantity?.toNumber();
    const rule = dto.recurringBuyRule ?? (existing?.recurring_buy_rule as Record<string, unknown> | null);
    const purchaseDate = dto.purchaseDate ?? (existing?.purchase_date ? existing.purchase_date.toISOString().slice(0, 10) : undefined);
    if (!symbol || !rule?.cycle || !purchaseDate || (!amount && !quantity)) {
      throw new BadRequestException('반복매수를 사용하려면 종목코드/티커, 회차금액 또는 회차수량, 반복 규칙, 최초 매수일이 모두 필요합니다.');
    }
  }

  // recurringBuyAmount/recurringBuyQuantity 상호 배타적 매핑 — 한쪽이 오면 다른 쪽은 null로 비움
  private recurringFields(dto: {
    recurringBuyEnabled?: boolean;
    recurringBuyAmount?: number;
    recurringBuyQuantity?: number;
  }): { amount: Prisma.Decimal | null | undefined; quantity: Prisma.Decimal | null | undefined } {
    if (dto.recurringBuyEnabled === false) return { amount: null, quantity: null };
    if (dto.recurringBuyAmount !== undefined) return { amount: new Prisma.Decimal(dto.recurringBuyAmount), quantity: null };
    if (dto.recurringBuyQuantity !== undefined) return { amount: null, quantity: new Prisma.Decimal(dto.recurringBuyQuantity) };
    return { amount: undefined, quantity: undefined };
  }

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
    this.validateRecurringBuy(dto);
    const { amount: recurringAmount, quantity: recurringQuantity } = this.recurringFields(dto);
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
        quantity: dto.quantity !== undefined
          ? new Prisma.Decimal(dto.quantity)
          : dto.recurringBuyEnabled ? new Prisma.Decimal(0) : undefined,
        principal,
        principal_usd: FOREIGN_TYPES.includes(dto.type) ? new Prisma.Decimal(dto.principal) : null,
        current_value: currentValue,
        purchase_date: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        memo: dto.memo,
        recurring_buy_enabled: dto.recurringBuyEnabled ?? false,
        recurring_buy_rule: dto.recurringBuyEnabled
          ? (dto.recurringBuyRule as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        recurring_buy_amount: recurringAmount,
        recurring_buy_quantity: recurringQuantity,
        // 등록 시점까지의 회차는 "이미 투자중"인 값을 그대로 신뢰 — 과거 회차를 소급 매수하지 않도록 현재 회차로 선점
        recurring_buy_last_period: dto.recurringBuyEnabled
          ? periodOf(new Date(), (dto.recurringBuyRule as unknown as RRule).cycle)
          : undefined,
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
    this.validateRecurringBuy(dto, existing);
    const { amount: recurringAmount, quantity: recurringQuantity } = this.recurringFields(dto);
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
        quantity: dto.quantity !== undefined
          ? new Prisma.Decimal(dto.quantity)
          : (dto.recurringBuyEnabled && !existing.quantity ? new Prisma.Decimal(0) : undefined),
        principal,
        principal_usd: dto.principal !== undefined && FOREIGN_TYPES.includes(type)
          ? new Prisma.Decimal(dto.principal)
          : undefined,
        current_value: currentValue,
        purchase_date: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        memo: dto.memo,
        recurring_buy_enabled: dto.recurringBuyEnabled,
        recurring_buy_rule: dto.recurringBuyEnabled === false
          ? Prisma.JsonNull
          : (dto.recurringBuyRule as Prisma.InputJsonValue | undefined),
        recurring_buy_amount: recurringAmount,
        recurring_buy_quantity: recurringQuantity,
        // 비활성→활성으로 새로 켜는 경우에만 현재 회차로 선점 — 과거 회차 소급 매수 방지(이미 활성 중이던 항목은 기존 진행 회차 유지)
        recurring_buy_last_period: dto.recurringBuyEnabled && !existing.recurring_buy_enabled
          ? periodOf(new Date(), ((dto.recurringBuyRule ?? existing.recurring_buy_rule) as unknown as RRule).cycle)
          : undefined,
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
          quantity: row.quantity ? { increment: dto.quantity } : new Prisma.Decimal(dto.quantity),
        },
      });
      return this.toDto(updated);
    });
  }

  // 매도 — 보유수량에서 매도수량을 차감하고, 수량×단가만큼 평가금액을 줄여 예수금으로 환입(원금은 누적 투입 기준 유지).
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
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.investment.update({
        where: { id },
        data: {
          current_value: newCurrentValue,
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
