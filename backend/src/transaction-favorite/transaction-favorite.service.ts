import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionFavorite } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionFavoriteDto } from './dto/create-transaction-favorite.dto';
import { UpdateTransactionFavoriteDto } from './dto/update-transaction-favorite.dto';

// 한 사용자가 둘 수 있는 즐겨찾기 수 — 상단 버튼 줄이 너무 길어지지 않게
export const MAX_FAVORITES = 50;

@Injectable()
export class TransactionFavoriteService {
  constructor(private prisma: PrismaService) {}

  // 엔티티 → 응답 DTO (Decimal→number)
  private toDto(f: TransactionFavorite) {
    return {
      id: f.id,
      type: f.type,
      title: f.title,
      category: f.category,
      amount: f.amount.toNumber(),
      payMethod: f.pay_method,
      memo: f.memo,
    };
  }

  // 즐겨찾기 목록 — 표시 순서대로
  async findAll(userId: number) {
    const rows = await this.prisma.transactionFavorite.findMany({
      where: { user_id: userId },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  // 즐겨찾기 추가 — 같은 유형·내역명·카테고리·결제수단이 이미 있으면 거부, 맨 뒤에 붙인다
  async create(userId: number, dto: CreateTransactionFavoriteDto) {
    const payMethod = dto.payMethod ?? '';
    const [dup, count, last] = await Promise.all([
      this.prisma.transactionFavorite.findFirst({
        where: { user_id: userId, type: dto.type, title: dto.title, category: dto.category, pay_method: payMethod },
        select: { id: true },
      }),
      this.prisma.transactionFavorite.count({ where: { user_id: userId } }),
      this.prisma.transactionFavorite.findFirst({
        where: { user_id: userId },
        orderBy: { sort_order: 'desc' },
        select: { sort_order: true },
      }),
    ]);
    if (dup) throw new ConflictException('이미 즐겨찾기에 있습니다.');
    if (count >= MAX_FAVORITES) throw new BadRequestException(`즐겨찾기는 ${MAX_FAVORITES}개까지 저장할 수 있습니다.`);

    const created = await this.prisma.transactionFavorite.create({
      data: {
        user_id: userId,
        type: dto.type,
        title: dto.title,
        category: dto.category,
        amount: new Prisma.Decimal(dto.amount),
        pay_method: payMethod,
        memo: dto.memo,
        sort_order: (last?.sort_order ?? -1) + 1,
      },
    });
    return this.toDto(created);
  }

  // 즐겨찾기 수정 — 바꾼 결과가 다른 즐겨찾기와 같아지면(유형·내역명·카테고리·결제수단) 거부
  async update(userId: number, id: number, dto: UpdateTransactionFavoriteDto) {
    const current = await this.prisma.transactionFavorite.findFirst({ where: { id, user_id: userId } });
    if (!current) throw new NotFoundException('즐겨찾기를 찾을 수 없습니다.');
    const next = {
      type: dto.type ?? current.type,
      title: dto.title ?? current.title,
      category: dto.category ?? current.category,
      pay_method: dto.payMethod ?? current.pay_method,
    };
    const dup = await this.prisma.transactionFavorite.findFirst({
      where: { user_id: userId, id: { not: id }, ...next },
      select: { id: true },
    });
    if (dup) throw new ConflictException('이미 즐겨찾기에 있습니다.');

    const updated = await this.prisma.transactionFavorite.update({
      where: { id },
      data: {
        ...next,
        amount: dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        memo: dto.memo,
      },
    });
    return this.toDto(updated);
  }

  // 표시 순서 변경 — 넘긴 id 순서대로 0,1,2… (본인 것이 아닌 id 가 섞이면 거부)
  async reorder(userId: number, ids: number[]) {
    const owned = await this.prisma.transactionFavorite.count({ where: { user_id: userId, id: { in: ids } } });
    if (owned !== new Set(ids).size || owned !== ids.length) throw new BadRequestException('잘못된 즐겨찾기 목록입니다.');
    await this.prisma.$transaction(
      ids.map((id, i) => this.prisma.transactionFavorite.update({ where: { id }, data: { sort_order: i } })),
    );
    return this.findAll(userId);
  }

  // 즐겨찾기 삭제 (즐겨찾기는 원본이 아니라 바로 지운다)
  async remove(userId: number, id: number) {
    const { count } = await this.prisma.transactionFavorite.deleteMany({ where: { id, user_id: userId } });
    if (!count) throw new NotFoundException('즐겨찾기를 찾을 수 없습니다.');
    return { id };
  }
}
