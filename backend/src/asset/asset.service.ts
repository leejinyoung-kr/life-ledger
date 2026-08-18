import { Injectable, NotFoundException } from '@nestjs/common';
import { Asset, AssetType, Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parsePage } from '@leejinyoun/core-common';
import { PriceLookupService } from '../investment/price-lookup.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { SystemLogService } from '../system-log/system-log.service';

@Injectable()
export class AssetService {
  constructor(
    private prisma: PrismaService,
    private priceLookup: PriceLookupService,
    private sysLog: SystemLogService,
  ) {}

  // 엔티티 → 응답 DTO (Decimal→number)
  private toDto(a: Asset) {
    return {
      id: a.id,
      type: a.type,
      name: a.name,
      amount: a.amount.toNumber(),
      interestRate: a.interest_rate ? a.interest_rate.toNumber() : null,
      memo: a.memo,
    };
  }

  // 자산/부채 목록 — 기본값은 realestate+debt만 반환 (cash/savings/investment는 각 전용 테이블에서 집계)
  // page 지정 시 서버 페이징({ items, total, page, limit, sum }), 없으면 전체 배열(take 옵션 호환)
  async findAll(userId: number, type?: AssetType, take?: number, page?: string, limit?: string) {
    const where: Prisma.AssetWhereInput = {
      user_id: userId,
      deleted_at: null,
      type: type ? type : { in: ['realestate', 'debt'] },
    };
    const orderBy: Prisma.AssetOrderByWithRelationInput = { created_at: 'desc' };

    const pg = parsePage(page, limit);
    if (pg) {
      // sum: 현재 필터 전체의 금액 합계 (StatCard 표시용 — 페이지 무관)
      const [rows, total, agg] = await this.prisma.$transaction([
        this.prisma.asset.findMany({ where, orderBy, skip: pg.skip, take: pg.take }),
        this.prisma.asset.count({ where }),
        this.prisma.asset.aggregate({ where, _sum: { amount: true } }),
      ]);
      return {
        items: rows.map((r) => this.toDto(r)),
        total,
        page: pg.page,
        limit: pg.limit,
        sum: agg._sum.amount?.toNumber() ?? 0,
      };
    }

    const rows = await this.prisma.asset.findMany({
      where,
      orderBy,
      ...(take ? { take } : {}),
    });
    return rows.map((r) => this.toDto(r));
  }

  // 'YYYY-MM' 다음달 1일 — 그 달 말까지 포함하는 배타적 상한 경계(스냅샷 컷오프)
  private firstDayOfMonthAfter(month: string): Date {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m, 1));
  }

  // 현금 흐름 합계(수입-지출) — dateFilter 지정 시 해당 구간만. 월말 스냅샷 저장·실시간 델타 계산에 공용 사용
  private async cashFlowSum(userId: number, dateFilter?: Prisma.DateTimeFilter): Promise<number> {
    const where = (type: TransactionType): Prisma.TransactionWhereInput => ({
      user_id: userId,
      deleted_at: null,
      type,
      ...(dateFilter ? { date: dateFilter } : {}),
    });
    const [incAgg, expAgg] = await Promise.all([
      this.prisma.transaction.aggregate({ where: where('income'), _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: where('expense'), _sum: { amount: true } }),
    ]);
    return (incAgg._sum.amount?.toNumber() ?? 0) - (expAgg._sum.amount?.toNumber() ?? 0);
  }

  // 특정 월 말 기준 누적 현금 총액 — 월간 순자산 스냅샷 저장용(NetWorthSnapshotCronService)
  async cashTotalForSnapshot(userId: number, month: string): Promise<number> {
    return this.cashFlowSum(userId, { lt: this.firstDayOfMonthAfter(month) });
  }

  // 요약 — 총자산/총부채/순자산 + 전월 대비 증감 + 도넛 구성 + 유형별 집계
  // 예적금 → Saving.balance, 투자 → Investment.current_value, 현금 → 수입-지출, 부동산/부채 → Asset 테이블
  async summary(userId: number) {
    // 서로 의존성 없는 조회는 한 번에 병렬 실행 (TiDB Cloud 왕복 지연 누적 방지)
    const [savings, investments, investmentAccounts, assetRows, prevSnap] =
      await Promise.all([
        this.prisma.saving.findMany({
          where: { user_id: userId, deleted_at: null },
          select: { balance: true, interest_rate: true },
        }),
        this.prisma.investment.findMany({
          where: { user_id: userId, deleted_at: null },
          select: { current_value: true },
        }),
        this.prisma.investmentAccount.findMany({
          where: { user_id: userId, deleted_at: null },
          select: { cash_balance: true, cash_balance_usd: true },
        }),
        this.prisma.asset.findMany({
          where: { user_id: userId, deleted_at: null, type: { in: ['realestate', 'debt'] } },
          select: { type: true, amount: true, interest_rate: true },
        }),
        this.prisma.netWorthSnapshot.findFirst({
          where: { user_id: userId, month: { lt: new Date().toISOString().slice(0, 7) } },
          orderBy: { month: 'desc' },
        }),
      ]);

    // 현금 총액 = 직전 월말 스냅샷 캐시값 + 그 이후 거래 델타(전체 재집계 대신 이번 달치만 스캔).
    // 스냅샷에 캐시값이 없으면(첫 크론 이전 신규 사용자 등) 전체 재집계로 폴백.
    const cashTotal =
      prevSnap?.cash_total != null
        ? prevSnap.cash_total.toNumber() +
          (await this.cashFlowSum(userId, { gte: this.firstDayOfMonthAfter(prevSnap.month) }))
        : await this.cashFlowSum(userId);

    const savingsTotal = savings.reduce((s, r) => s + r.balance.toNumber(), 0);
    const savingsAvgRate = savings.length
      ? Math.round(
          (savings.reduce((s, r) => s + r.interest_rate.toNumber(), 0) / savings.length) * 100,
        ) / 100
      : null;

    // 달러 예수금은 환율 적용해 원화로 환산 (미투자 대기 현금도 자산이므로 합산)
    const usdTotal = investmentAccounts.reduce((s, r) => s + r.cash_balance_usd.toNumber(), 0);
    const usdToKrw = usdTotal
      ? await this.priceLookup.getExchangeRate('USD', 'KRW').catch((e: unknown) => {
          this.sysLog.warn({ userId, category: 'asset', message: '달러 환율 조회 실패 — 달러 자산 0원 처리', metadata: { error: (e as Error).message, usdAmount: usdTotal } });
          return 0;
        })
      : 0;
    const investTotal =
      investments.reduce((s, r) => s + r.current_value.toNumber(), 0) +
      investmentAccounts.reduce((s, r) => s + r.cash_balance.toNumber(), 0) +
      Math.round(usdTotal * usdToKrw);

    // 부동산 + 부채 — Asset 테이블에서만 관리
    const realestateRows = assetRows.filter((r) => r.type === 'realestate');
    const debtRows = assetRows.filter((r) => r.type === 'debt');
    const realestateTotal = realestateRows.reduce((s, r) => s + r.amount.toNumber(), 0);
    const debtTotal = debtRows.reduce((s, r) => s + r.amount.toNumber(), 0);

    const totalAssets = cashTotal + savingsTotal + investTotal + realestateTotal;
    const totalDebt = debtTotal;
    const netWorth = totalAssets - totalDebt;

    // 도넛 구성 — 자산 유형별 비중(%)
    const allocation = [
      { type: 'cash' as AssetType, amount: cashTotal },
      { type: 'savings' as AssetType, amount: savingsTotal },
      { type: 'investment' as AssetType, amount: investTotal },
      { type: 'realestate' as AssetType, amount: realestateTotal },
    ]
      .filter((a) => a.amount > 0)
      .map((a) => ({
        type: a.type,
        amount: a.amount,
        percent: totalAssets > 0 ? Math.round((a.amount / totalAssets) * 100) : 0,
      }));

    // 유형별 카드
    const byType = [
      { type: 'cash' as AssetType, amount: cashTotal, count: cashTotal > 0 ? 1 : 0, avgRate: null },
      { type: 'savings' as AssetType, amount: savingsTotal, count: savings.length, avgRate: savingsAvgRate },
      { type: 'investment' as AssetType, amount: investTotal, count: investments.length, avgRate: null },
      { type: 'realestate' as AssetType, amount: realestateTotal, count: realestateRows.length, avgRate: null },
    ].filter((b) => b.amount > 0 || b.count > 0);

    // 전월 대비 증감
    let changeAmount = 0;
    let changeRate = 0;
    if (prevSnap) {
      const prevNet = prevSnap.total_assets.toNumber() - prevSnap.total_debt.toNumber();
      changeAmount = netWorth - prevNet;
      changeRate = prevNet !== 0 ? Math.round((changeAmount / prevNet) * 1000) / 10 : 0;
    }

    return { totalAssets, totalDebt, netWorth, changeAmount, changeRate, allocation, byType };
  }

  // 순자산 추이 — 최근 6개월 스냅샷 (월 오름차순)
  async trend(userId: number) {
    const snaps = await this.prisma.netWorthSnapshot.findMany({
      where: { user_id: userId },
      orderBy: { month: 'desc' },
      take: 6,
    });
    const latest = snaps[0]?.month;
    return snaps
      .reverse()
      .map((s) => ({
        month: s.month,
        label: `${Number(s.month.slice(5))}월`,
        netWorth: s.total_assets.toNumber() - s.total_debt.toNumber(),
        current: s.month === latest,
      }));
  }

  // 자산/부채 추가
  async create(userId: number, dto: CreateAssetDto) {
    const created = await this.prisma.asset.create({
      data: {
        user_id: userId,
        type: dto.type,
        name: dto.name,
        amount: new Prisma.Decimal(dto.amount),
        interest_rate: dto.interestRate !== undefined ? new Prisma.Decimal(dto.interestRate) : null,
        memo: dto.memo,
      },
    });
    return this.toDto(created);
  }

  // 본인 소유 + 미삭제 확인
  private async findOwned(userId: number, id: number): Promise<Asset> {
    const row = await this.prisma.asset.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('자산을 찾을 수 없습니다.');
    return row;
  }

  // 자산/부채 수정
  async update(userId: number, id: number, dto: UpdateAssetDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        type: dto.type,
        name: dto.name,
        amount: dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        interest_rate:
          dto.interestRate !== undefined ? new Prisma.Decimal(dto.interestRate) : undefined,
        memo: dto.memo,
      },
    });
    return this.toDto(updated);
  }

  // 자산/부채 삭제 (soft delete)
  async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await this.prisma.asset.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { id };
  }
}
