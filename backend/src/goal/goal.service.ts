import { Injectable, NotFoundException } from '@nestjs/common';
import { Goal, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

@Injectable()
export class GoalService {
  constructor(private prisma: PrismaService) {}

  // 엔티티 → 응답 DTO (Decimal→number)
  private toDto(g: Goal) {
    return {
      id: g.id,
      name: g.name,
      unit: g.unit,
      currentVal: g.current_val.toNumber(),
      targetVal: g.target_val.toNumber(),
      pct: g.pct,
      tone: g.tone,
    };
  }

  // 목표 목록
  async findAll(userId: number) {
    const rows = await this.prisma.goal.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  // 목표 추가
  async create(userId: number, dto: CreateGoalDto) {
    const created = await this.prisma.goal.create({
      data: {
        user_id: userId,
        name: dto.name,
        unit: dto.unit,
        current_val: new Prisma.Decimal(dto.currentVal),
        target_val: new Prisma.Decimal(dto.targetVal),
        pct: dto.pct,
        tone: dto.tone ?? 'green',
      },
    });
    return this.toDto(created);
  }

  // 본인 소유 + 미삭제 확인
  private async findOwned(userId: number, id: number): Promise<Goal> {
    const row = await this.prisma.goal.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('목표를 찾을 수 없습니다.');
    return row;
  }

  // 목표 수정
  async update(userId: number, id: number, dto: UpdateGoalDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.goal.update({
      where: { id },
      data: {
        name: dto.name,
        unit: dto.unit,
        current_val: dto.currentVal !== undefined ? new Prisma.Decimal(dto.currentVal) : undefined,
        target_val: dto.targetVal !== undefined ? new Prisma.Decimal(dto.targetVal) : undefined,
        pct: dto.pct,
        tone: dto.tone,
      },
    });
    return this.toDto(updated);
  }

  // 목표 삭제 (soft delete)
  async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await this.prisma.goal.update({ where: { id }, data: { deleted_at: new Date() } });
    return { id };
  }
}
