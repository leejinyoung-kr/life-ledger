import { Injectable } from '@nestjs/common';
import { OutboxService, WebPushService } from '@leejinyoun/core-notification';
import { PrismaService } from '../prisma/prisma.service';
import { WebPushChannel } from './webpush.channel';
import type { PushMessage } from './webpush.channel';

export type { PushDelivery, PushMessage, PushPayload } from './webpush.channel';

@Injectable()
export class PushService {
  constructor(
    private prisma: PrismaService,
    private webPush: WebPushService,
    private outbox: OutboxService,
    private channel: WebPushChannel,
  ) {}

  // 프론트가 구독 전 공개키를 받아간다. 비활성이면 enabled=false 만 반환
  getPublicKey(): { enabled: boolean; publicKey: string | null } {
    return this.webPush.getPublicKey();
  }

  // 구독 저장 — endpoint 기준 upsert (같은 기기 재구독 시 키 갱신). 비활성이어도 저장은 허용
  async subscribe(
    userId: number,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string,
  ): Promise<{ ok: boolean }> {
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return { ok: false };
    }
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: userAgent?.slice(0, 300) ?? null,
      },
      update: {
        user_id: userId,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
    });
    return { ok: true };
  }

  // 구독 해제 — endpoint 기준 삭제
  async unsubscribe(userId: number, endpoint: string): Promise<{ ok: boolean }> {
    await this.prisma.pushSubscription.deleteMany({ where: { user_id: userId, endpoint } });
    return { ok: true };
  }

  // 테스트 발송 — 본인 모든 기기로 더미 푸시. 결과를 화면에서 바로 봐야 하므로 아웃박스를 거치지 않고 바로 보낸다.
  // 진단용 상태(서버활성/구독수)도 반환
  async sendTest(userId: number): Promise<{ enabled: boolean; subscriptions: number }> {
    const subscriptions = await this.prisma.pushSubscription.count({ where: { user_id: userId } });
    const { enabled } = this.webPush.getPublicKey();
    if (enabled && subscriptions > 0) {
      await this.channel.deliver(userId, {
        title: '테스트 푸시',
        body: '푸시 알림이 정상 작동합니다.',
        url: '/settings',
      });
    }
    return { enabled, subscriptions };
  }

  // 알림 행과 같은 트랜잭션에 푸시를 적재한다 — 커밋돼야 나간다(롤백되면 푸시도 사라진다).
  // 멱등키는 알림 id — 같은 알림으로 두 번 보내지 않는다
  async enqueue(tx: unknown, notificationId: number, message: PushMessage): Promise<void> {
    // 푸시가 꺼진 환경(VAPID 키 없음)에서는 보낼 곳이 없으므로 쌓지 않는다. 앱 내 알림은 그대로 남는다
    if (!this.webPush.getPublicKey().enabled) return;
    await this.outbox.enqueue(tx, {
      channel: 'webpush',
      payload: message,
      idempotencyKey: `noti:${notificationId}`,
    });
  }

  // 커밋 직후 호출 — 다음 주기(10초)를 기다리지 않고 바로 보낸다. 기다리지 않는다
  flush(): void {
    this.outbox.flush();
  }
}
