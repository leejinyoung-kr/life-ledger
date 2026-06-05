import { Injectable, NotFoundException } from '@nestjs/common';
import { Asset, AssetType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Injectable()
export class AssetService {
  constructor(private prisma: PrismaService) {}

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
  async findAll(userId: number, type?: AssetType) {
    const rows = await this.prisma.asset.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        type: type ? type : { in: ['realestate', 'debt'] },
      },
      orderBy: [{ type: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  // 요약 — 총자산/총부채/순자산 + 전월 대비 증감 + 도넛 구성 + 유형별 집계
  // 예적금 → Saving.balance, 투자 → Investment.current_value, 현금 → 수입-지출, 부동산/부채 → Asset 테이블
  async summary(userId: number) {
    // 예적금 합계
    const savings = await this.prisma.saving.findMany({
      where: { user_id: userId, deleted_at: null },
      select: { balance: true, interest_rate: true },
    });
    const savingsTotal = savings.reduce((s, r) => s + r.balance.toNumber(), 0);
    const savingsAvgRate = savings.length
      ? Math.round(
          (savings.reduce((s, r) => s + r.interest_rate.toNumber(), 0) / savings.length) * 100,
        ) / 100
      : null;

    // 투자 평가금액 합계
    const investments = await this.prisma.investment.findMany({
      where: { user_id: userId, deleted_at: null },
      select: { current_value: true },
    });
    const investTotal = investments.reduce((s, r) => s + r.current_value.toNumber(), 0);

    // 현금 = 수입 합계 - 지출 합계
    const [incAgg, expAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { user_id: userId, deleted_at: null, type: 'income' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { user_id: userId, deleted_at: null, type: 'expense' },
        _sum: { amount: true },
      }),
    ]);
    const cashTotal =
      (incAgg._sum.amount?.toNumber() ?? 0) - (expAgg._sum.amount?.toNumber() ?? 0);

    // 부동산 + 부채 — Asset 테이블에서만 관리
    const assetRows = await this.prisma.asset.findMany({
      where: { user_id: userId, deleted_at: null, type: { in: ['realestate', 'debt'] } },
      select: { type: true, amount: true, interest_rate: true },
    });
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
    const nowMonth = new Date().toISOString().slice(0, 7);
    const prevSnap = await this.prisma.netWorthSnapshot.findFirst({
      where: { user_id: userId, month: { lt: nowMonth } },
      orderBy: { month: 'desc' },
    });
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
