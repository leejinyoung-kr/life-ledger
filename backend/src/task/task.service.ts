import { Injectable, NotFoundException } from '@nestjs/common';
import { Task } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

// Date → 'YYYY-MM-DD'
function toDateStr(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

@Injectable()
export class TaskService {
  constructor(private prisma: PrismaService) {}

  // 엔티티 → 응답 DTO
  private toDto(t: Task) {
    return {
      id: t.id,
      text: t.text,
      dueDate: toDateStr(t.due_date),
      priority: t.priority,
      memo: t.memo,
      done: t.done,
    };
  }

  // 할일 목록 — 미완료 먼저, 마감 가까운 순
  async findAll(userId: number) {
    const rows = await this.prisma.task.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: [{ done: 'asc' }, { due_date: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  // 할일 추가
  async create(userId: number, dto: CreateTaskDto) {
    const done = dto.done ?? false;
    const created = await this.prisma.task.create({
      data: {
        user_id: userId,
        text: dto.text,
        due_date: dto.dueDate ? new Date(dto.dueDate) : null,
        priority: dto.priority ?? 'normal',
        memo: dto.memo,
        done,
        done_at: done ? new Date() : null,
      },
    });
    return this.toDto(created);
  }

  // 본인 소유 + 미삭제 확인
  private async findOwned(userId: number, id: number): Promise<Task> {
    const row = await this.prisma.task.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('할일을 찾을 수 없습니다.');
    return row;
  }

  // 할일 수정 (완료 토글 포함 — done 변경 시 done_at 동기화)
  async update(userId: number, id: number, dto: UpdateTaskDto) {
    const row = await this.findOwned(userId, id);
    const doneChanged = dto.done !== undefined && dto.done !== row.done;
    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        text: dto.text,
        due_date: dto.dueDate ? new Date(dto.dueDate) : undefined,
        priority: dto.priority,
        memo: dto.memo,
        done: dto.done,
        done_at: doneChanged ? (dto.done ? new Date() : null) : undefined,
      },
    });
    return this.toDto(updated);
  }

  // 할일 삭제 (soft delete)
  async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await this.prisma.task.update({ where: { id }, data: { deleted_at: new Date() } });
    return { id };
  }
}
