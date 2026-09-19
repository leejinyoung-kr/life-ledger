import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Notification, NotiGroup, NotiTone, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { parsePage } from '@leejinyoun/core-common';
import { QueryNotificationDto } from './dto/query-notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  // 다른 모듈(파일 업로드 등 이벤트성 알림)에서 즉시 1건 생성할 때 사용
  async create(userId: number, n: { group: NotiGroup; tone: NotiTone; title: string; description: string; source: string }): Promise<Notification> {
    return this.prisma.notification.create({ data: { user_id: userId, ...n } });
  }

  // 알림 1건 생성 + 같은 트랜잭션에 웹푸시 적재 — 알림 저장이 롤백되면 푸시도 나가지 않는다.
  // 푸시 발송은 아웃박스가 맡는다(실패하면 재시도, 최종 실패는 /logs 에 남음)
  async createWithPush(
    userId: number,
    n: { group: NotiGroup; tone: NotiTone; title: string; description: string; source: string },
    push: { url?: string; body?: string } = {},
  ): Promise<Notification> {
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.notification.create({ data: { user_id: userId, ...n } });
      await this.push.enqueue(tx, row.id, {
        userId,
        title: row.title,
        body: push.body ?? row.description,
        url: push.url ?? '/notifications',
      });
      return row;
    });
    // 커밋된 뒤에 깨운다 — 다음 주기를 기다리지 않고 바로 나간다
    this.push.flush();
    return created;
  }

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

  // 알림 목록 (최신순) — 그룹 필터. page 지정 시 서버 페이징, 없으면 전체 배열
  async findAll(userId: number, query: QueryNotificationDto = {}) {
    const where: Prisma.NotificationWhereInput = { user_id: userId };
    if (query.group) where.group = query.group as NotiGroup;
    const orderBy: Prisma.NotificationOrderByWithRelationInput = { occurred_at: 'desc' };

    const pg = parsePage(query.page, query.limit);
    if (pg) {
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.notification.findMany({ where, orderBy, skip: pg.skip, take: pg.take }),
        this.prisma.notification.count({ where }),
      ]);
      return { items: rows.map((r) => this.toDto(r)), total, page: pg.page, limit: pg.limit };
    }

    const rows = await this.prisma.notification.findMany({ where, orderBy });
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
