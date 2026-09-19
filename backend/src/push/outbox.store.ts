import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OutboxStore } from '@leejinyoun/core-notification';
import type {
  OutboxEnqueue,
  OutboxFailure,
  OutboxId,
  OutboxPending,
} from '@leejinyoun/core-notification';
import { PrismaService } from '../prisma/prisma.service';
import { SystemLogService } from '../system-log/system-log.service';

// core-notification 아웃박스를 outbox_message 테이블에 담는다.
// 적재는 호출부 트랜잭션(tx)에서, 발송 선점은 행마다 compare-and-swap 으로 한 프로세스만 가져가게 한다.
@Injectable()
export class PrismaOutboxStore extends OutboxStore {
  constructor(
    private prisma: PrismaService,
    private sysLog: SystemLogService,
  ) {
    super();
  }

  // tx 안에서 넣는다 — 호출부가 롤백하면 이 행도 사라진다. 멱등키 유니크 충돌(P2002)은 중복이므로 false
  async enqueue(tx: unknown, message: OutboxEnqueue): Promise<boolean> {
    const client = (tx as Prisma.TransactionClient) ?? this.prisma;
    try {
      await client.outboxMessage.create({
        data: {
          channel: message.channel,
          payload: JSON.stringify(message.payload),
          idempotency_key: message.idempotencyKey,
          status: 'pending',
          max_attempts: message.maxAttempts,
          available_at: message.availableAt,
        },
        select: { id: true },
      });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false;
      throw e;
    }
  }

  // 후보를 고른 뒤 행마다 pending → sending 으로 바꿔 본다. 바뀐 행만 이 프로세스 것이다
  async claim(now: Date, claimUntil: Date, limit: number): Promise<OutboxPending[]> {
    const candidates = await this.prisma.outboxMessage.findMany({
      where: { status: 'pending', available_at: { lte: now } },
      orderBy: { available_at: 'asc' },
      take: limit,
      select: {
        id: true,
        channel: true,
        payload: true,
        idempotency_key: true,
        attempts: true,
        max_attempts: true,
      },
    });

    const claimed: OutboxPending[] = [];
    for (const row of candidates) {
      const { count } = await this.prisma.outboxMessage.updateMany({
        where: { id: row.id, status: 'pending' },
        data: { status: 'sending', claimed_until: claimUntil },
      });
      if (count !== 1) continue; // 다른 프로세스가 먼저 가져갔다
      claimed.push({
        id: row.id,
        channel: row.channel,
        payload: JSON.parse(row.payload) as unknown,
        idempotencyKey: row.idempotency_key,
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
      });
    }
    return claimed;
  }

  async markSent(id: OutboxId, sentAt: Date): Promise<void> {
    await this.prisma.outboxMessage.updateMany({
      where: { id: Number(id), status: 'sending' },
      data: { status: 'sent', sent_at: sentAt, claimed_until: null },
    });
  }

  // 재시도면 pending 으로 되돌리고, 마감이면 failed. 마감은 시스템 로그에도 남겨 /logs 에서 보이게 한다
  async markFailed(id: OutboxId, failure: OutboxFailure): Promise<void> {
    const closed = failure.nextAt === null;
    const { count } = await this.prisma.outboxMessage.updateMany({
      where: { id: Number(id), status: 'sending' },
      data: {
        status: closed ? 'failed' : 'pending',
        attempts: failure.attempts,
        last_error: failure.error,
        claimed_until: null,
        ...(closed ? {} : { available_at: failure.nextAt as Date }),
      },
    });
    if (count && closed) {
      const row = await this.prisma.outboxMessage.findUnique({
        where: { id: Number(id) },
        select: { channel: true },
      });
      this.sysLog.error({
        category: 'notification',
        message: `알림 발송 실패: ${row?.channel ?? '?'}`,
        metadata: {
          outboxId: Number(id),
          attempts: failure.attempts,
          error: failure.error.split('\n')[0],
        },
      });
    }
  }

  // 발송 중 프로세스가 죽어 sending 으로 남은 행을 다시 대기로 돌린다
  async releaseClaims(now: Date): Promise<number> {
    const { count } = await this.prisma.outboxMessage.updateMany({
      where: { status: 'sending', claimed_until: { lt: now } },
      data: { status: 'pending', claimed_until: null },
    });
    return count;
  }
}
