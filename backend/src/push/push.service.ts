import { Injectable } from '@nestjs/common';
import { WebPushService } from '@leejinyoun/core-notification';
import { PrismaService } from '../prisma/prisma.service';

// 푸시 페이로드 — 민감정보 금지(제목/요약만). 상세는 앱을 열어 확인하게 한다.
export interface PushPayload {
  title: string;
  body: string;
  url?: string; // 클릭 시 이동 경로 (기본 /notifications)
}

@Injectable()
export class PushService {
  constructor(
    private prisma: PrismaService,
    private webPush: WebPushService,
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

  // 테스트 발송 — 본인 모든 기기로 더미 푸시. 진단용 상태(서버활성/구독수)도 반환
  async sendTest(userId: number): Promise<{ enabled: boolean; subscriptions: number }> {
    const subscriptions = await this.prisma.pushSubscription.count({ where: { user_id: userId } });
    const { enabled } = this.webPush.getPublicKey();
    if (enabled && subscriptions > 0) {
      await this.sendToUser(userId, {
        title: '테스트 푸시',
        body: '푸시 알림이 정상 작동합니다.',
        url: '/settings',
      });
    }
    return { enabled, subscriptions };
  }

  // 한 사용자의 모든 기기로 푸시 발송 — 비활성이면 즉시 반환(no-op). 만료(404/410) 구독은 정리
  async sendToUser(userId: number, payload: PushPayload): Promise<void> {
    const { enabled } = this.webPush.getPublicKey();
    if (!enabled) return;

    const subs = await this.prisma.pushSubscription.findMany({ where: { user_id: userId } });
    if (!subs.length) return;

    await Promise.all(
      subs.map(async (s) => {
        const result = await this.webPush.sendToSubscription(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        if (result.expired) {
          await this.prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }),
    );
  }
}
