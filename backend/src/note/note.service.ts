import { Injectable, NotFoundException } from '@nestjs/common';
import { Note } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Injectable()
export class NoteService {
  constructor(private prisma: PrismaService) {}

  // 엔티티 → 응답 DTO (수정시각은 목록 정렬/표시용)
  private toDto(n: Note) {
    return {
      id: n.id,
      title: n.title,
      body: n.body,
      tag: n.tag,
      updatedAt: n.updated_at.toISOString(),
    };
  }

  // 메모 목록 (최근 수정순)
  async findAll(userId: number) {
    const rows = await this.prisma.note.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { updated_at: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  // 메모 추가 (빈 값이면 기본 제목으로)
  async create(userId: number, dto: CreateNoteDto) {
    const created = await this.prisma.note.create({
      data: {
        user_id: userId,
        title: dto.title?.trim() || '새 메모',
        body: dto.body ?? '',
        tag: dto.tag || null,
      },
    });
    return this.toDto(created);
  }

  // 본인 소유 + 미삭제 확인
  private async findOwned(userId: number, id: number): Promise<Note> {
    const row = await this.prisma.note.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('메모를 찾을 수 없습니다.');
    return row;
  }

  // 메모 수정 (tag 빈 문자열이면 제거)
  async update(userId: number, id: number, dto: UpdateNoteDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.note.update({
      where: { id },
      data: {
        title: dto.title,
        body: dto.body,
        tag: dto.tag === undefined ? undefined : dto.tag || null,
      },
    });
    return this.toDto(updated);
  }

  // 메모 삭제 (soft delete)
  async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await this.prisma.note.update({ where: { id }, data: { deleted_at: new Date() } });
    return { id };
  }
}
