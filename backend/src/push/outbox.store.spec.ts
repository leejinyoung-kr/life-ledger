import { Prisma } from '@prisma/client';
import { PrismaOutboxStore } from './outbox.store';

// outbox_message 저장소 회귀 테스트 — 호출부 트랜잭션에 적재, 멱등키 충돌 → false,
// 선점은 pending 인 행만(compare-and-swap), 마감은 시스템 로그 한 줄. Prisma 는 가짜로 대체
describe('PrismaOutboxStore', () => {
  let prisma: any;
  let sysLog: { error: jest.Mock };
  let store: PrismaOutboxStore;

  const message = {
    channel: 'webpush',
    payload: { userId: 1, title: '만기 임박', body: '3일 남음' },
    idempotencyKey: 'noti:42',
    availableAt: new Date('2026-09-20T09:00:00+09:00'),
    maxAttempts: 5,
  };

  beforeEach(() => {
    prisma = {
      outboxMessage: {
        create: jest.fn().mockResolvedValue({ id: 3 }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ channel: 'webpush' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    sysLog = { error: jest.fn() };
    store = new PrismaOutboxStore(prisma, sysLog as any);
  });

  it('넘겨받은 트랜잭션(tx)에 적재한다 — 롤백되면 메시지도 사라지게', async () => {
    const tx = { outboxMessage: { create: jest.fn().mockResolvedValue({ id: 9 }) } };

    expect(await store.enqueue(tx, message)).toBe(true);
    // 트랜잭션 밖 클라이언트로 새지 않아야 한다
    expect(prisma.outboxMessage.create).not.toHaveBeenCalled();
    expect(tx.outboxMessage.create).toHaveBeenCalledWith({
      data: {
        channel: 'webpush',
        payload: JSON.stringify(message.payload),
        idempotency_key: 'noti:42',
        status: 'pending',
        max_attempts: 5,
        available_at: message.availableAt,
      },
      select: { id: true },
    });
  });

  it('멱등키 유니크 충돌(P2002)이면 이미 적재된 것 → false', async () => {
    const tx = {
      outboxMessage: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
        ),
      },
    };
    expect(await store.enqueue(tx, message)).toBe(false);
  });

  it('그 밖의 DB 오류는 그대로 던진다 — 알림 트랜잭션이 함께 롤백되게', async () => {
    const tx = { outboxMessage: { create: jest.fn().mockRejectedValue(new Error('connect ETIMEDOUT')) } };
    await expect(store.enqueue(tx, message)).rejects.toThrow('connect ETIMEDOUT');
  });

  it('선점은 pending 인 행만 바꿔 성공한 것만 가져간다', async () => {
    prisma.outboxMessage.findMany.mockResolvedValue([
      { id: 3, channel: 'webpush', payload: JSON.stringify(message.payload), idempotency_key: 'noti:42', attempts: 1, max_attempts: 5 },
      { id: 4, channel: 'webpush', payload: '{}', idempotency_key: 'noti:43', attempts: 0, max_attempts: 5 },
    ]);
    // 두 번째 행은 다른 프로세스가 먼저 가져간 상황
    prisma.outboxMessage.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const now = new Date('2026-09-20T09:00:00+09:00');
    const claimUntil = new Date('2026-09-20T09:01:00+09:00');
    const claimed = await store.claim(now, claimUntil, 20);

    expect(claimed).toEqual([
      { id: 3, channel: 'webpush', payload: message.payload, idempotencyKey: 'noti:42', attempts: 1, maxAttempts: 5 },
    ]);
    expect(prisma.outboxMessage.updateMany).toHaveBeenCalledWith({
      where: { id: 3, status: 'pending' },
      data: { status: 'sending', claimed_until: claimUntil },
    });
  });

  it('재시도는 pending 으로 되돌리고 다음 시각을 적는다 — 시스템 로그는 남기지 않는다', async () => {
    const nextAt = new Date('2026-09-20T09:00:30+09:00');
    await store.markFailed(3, { attempts: 1, error: 'Error: 푸시 서버 502', nextAt, at: new Date() });

    expect(prisma.outboxMessage.updateMany).toHaveBeenCalledWith({
      where: { id: 3, status: 'sending' },
      data: {
        status: 'pending',
        attempts: 1,
        last_error: 'Error: 푸시 서버 502',
        claimed_until: null,
        available_at: nextAt,
      },
    });
    expect(sysLog.error).not.toHaveBeenCalled();
  });

  it('마감(nextAt 없음)은 failed 로 바꾸고 시스템 로그에 첫 줄을 남긴다', async () => {
    await store.markFailed(3, {
      attempts: 5,
      error: 'Error: 푸시 서버 502\n    at send (x.ts:1:1)',
      nextAt: null,
      at: new Date(),
    });

    expect(prisma.outboxMessage.updateMany).toHaveBeenCalledWith({
      where: { id: 3, status: 'sending' },
      data: { status: 'failed', attempts: 5, last_error: 'Error: 푸시 서버 502\n    at send (x.ts:1:1)', claimed_until: null },
    });
    expect(sysLog.error).toHaveBeenCalledWith({
      category: 'notification',
      message: '알림 발송 실패: webpush',
      metadata: { outboxId: 3, attempts: 5, error: 'Error: 푸시 서버 502' },
    });
  });

  it('이미 마감된 행이면(변경 0건) 시스템 로그를 남기지 않는다', async () => {
    prisma.outboxMessage.updateMany.mockResolvedValue({ count: 0 });
    await store.markFailed(3, { attempts: 5, error: 'x', nextAt: null, at: new Date() });
    expect(sysLog.error).not.toHaveBeenCalled();
  });

  it('선점 만료(sending + claimed_until 지남)만 대기로 되돌린다', async () => {
    prisma.outboxMessage.updateMany.mockResolvedValue({ count: 2 });
    const now = new Date();

    expect(await store.releaseClaims(now)).toBe(2);
    expect(prisma.outboxMessage.updateMany).toHaveBeenCalledWith({
      where: { status: 'sending', claimed_until: { lt: now } },
      data: { status: 'pending', claimed_until: null },
    });
  });

  it('발송 성공은 sending 인 행만 sent 로 바꾼다', async () => {
    const sentAt = new Date();
    await store.markSent(3, sentAt);
    expect(prisma.outboxMessage.updateMany).toHaveBeenCalledWith({
      where: { id: 3, status: 'sending' },
      data: { status: 'sent', sent_at: sentAt, claimed_until: null },
    });
  });
});
