import { Injectable, NotFoundException } from '@nestjs/common';
import { Asset, AssetType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

// 도넛/카드에 노출하는 자산 유형 순서 (debt 제외)
const ASSET_TYPE_ORDER: AssetType[] = ['cash', 'savings', 'investment', 'realestate', 'etc'];

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

  // 자산/부채 목록
  async findAll(userId: number) {
    const rows = await this.prisma.asset.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: [{ type: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  // 요약 — 총자산/총부채/순자산 + 전월 대비 증감 + 도넛 구성 + 유형별 집계
  async summary(userId: number) {
    const rows = await this.prisma.asset.findMany({
      where: { user_id: userId, deleted_at: null },
    });

    const debts = rows.filter((r) => r.type === 'debt');
    const assets = rows.filter((r) => r.type !== 'debt');
    const totalAssets = assets.reduce((s, r) => s + r.amount.toNumber(), 0);
    const totalDebt = debts.reduce((s, r) => s + r.amount.toNumber(), 0);
    const netWorth = totalAssets - totalDebt;

    // 도넛 구성 — 자산을 유형별로 묶어 비중(%) 산출
    const allocation = ASSET_TYPE_ORDER.map((type) => {
      const amount = assets
        .filter((r) => r.type === type)
        .reduce((s, r) => s + r.amount.toNumber(), 0);
      return {
        type,
        amount,
        percent: totalAssets > 0 ? Math.round((amount / totalAssets) * 100) : 0,
      };
    }).filter((a) => a.amount > 0);

    // 유형별 카드 — 금액 + 항목 수 + 평균 금리(있는 항목만)
    const byType = ASSET_TYPE_ORDER.filter((t) => t !== 'etc').map((type) => {
      const group = assets.filter((r) => r.type === type);
      const amount = group.reduce((s, r) => s + r.amount.toNumber(), 0);
      const rated = group.filter((r) => r.interest_rate !== null);
      const avgRate = rated.length
        ? Math.round(
            (rated.reduce((s, r) => s + r.interest_rate!.toNumber(), 0) / rated.length) * 100,
          ) / 100
        : null;
      return { type, amount, count: group.length, avgRate };
    });

    // 전월 대비 — 현재월 직전 스냅샷의 순자산과 비교
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
