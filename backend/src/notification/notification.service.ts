import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  // 엔티티 → 응답 DTO (read_at → read 불리언, 시각은 ISO 문자열)
  private toDto(n: Notification) {
    return {
      id: n.id,
      group: n.group,
      tone: n.tone,
      title: n.title,
      desc: n.description,
      source: n.source,
      read: n.read_at !== null,
      occurredAt: n.occurred_at.toISOString(),
    };
  }

  // 미읽음 알림 수 (read_at IS NULL)
  async unreadCount(userId: number): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({ where: { user_id: userId, read_at: null } });
    return { count };
  }

  // 알림 목록 (최신순)
  async findAll(userId: number) {
    const rows = await this.prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: { occurred_at: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  // 단일 알림 읽음 처리 (이미 읽었으면 그대로)
  async markRead(userId: number, id: number) {
    const row = await this.prisma.notification.findFirst({ where: { id, user_id: userId } });
    if (!row) throw new NotFoundException('알림을 찾을 수 없습니다.');
    if (!row.read_at) {
      await this.prisma.notification.update({ where: { id }, data: { read_at: new Date() } });
    }
    return { id };
  }

  // 안읽은 알림 전체 읽음 처리
  async markAllRead(userId: number) {
    const res = await this.prisma.notification.updateMany({
      where: { user_id: userId, read_at: null },
      data: { read_at: new Date() },
    });
    return { updated: res.count };
  }

  // 단일 알림 삭제
  async remove(userId: number, id: number) {
    const row = await this.prisma.notification.findFirst({ where: { id, user_id: userId } });
    if (!row) throw new NotFoundException('알림을 찾을 수 없습니다.');
    await this.prisma.notification.delete({ where: { id } });
    return { id };
  }

  // 선택 알림 삭제
  async removeSelected(userId: number, ids: number[]) {
    if (!ids.length) throw new BadRequestException('삭제할 알림을 선택하세요.');
    const res = await this.prisma.notification.deleteMany({ where: { id: { in: ids }, user_id: userId } });
    return { deleted: res.count };
  }

  // 전체 알림 삭제
  async removeAll(userId: number) {
    const res = await this.prisma.notification.deleteMany({ where: { user_id: userId } });
    return { deleted: res.count };
  }
}
