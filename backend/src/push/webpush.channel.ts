import { Injectable } from '@nestjs/common';
import {
  OutboxChannel,
  OutboxPermanentError,
  WebPushService,
} from '@leejinyoung-kr/core-notification';
import { PrismaService } from '../prisma/prisma.service';

// 푸시 페이로드 — 민감정보 금지(제목/요약만). 상세는 앱을 열어 확인하게 한다.
export interface PushPayload {
  title: string;
  body: string;
  url?: string; // 클릭 시 이동 경로 (기본 /notifications)
}

// 아웃박스에 담기는 값 — 발송 시점에 알림 행을 다시 읽지 않도록 필요한 것을 다 담는다
export interface PushMessage extends PushPayload {
  userId: number;
}

// 한 사용자에게 보낸 결과 — 재시도 여부 판단과 테스트 발송 진단에 쓴다
export interface PushDelivery {
  enabled: boolean;
  devices: number;
  sent: number;
  expired: number;
  failed: number;
  errors: string[];
}

// 실제 웹푸시 발송기이자 아웃박스의 'webpush' 채널.
// 아웃박스에서 부르면 실패를 던져 재시도·기록이 되게 하고, 재시도해도 소용없는 실패는 OutboxPermanentError 로 구분한다
@Injectable()
export class WebPushChannel extends OutboxChannel {
  readonly name = 'webpush';

  constructor(
    private prisma: PrismaService,
    private webPush: WebPushService,
  ) {
    super();
  }

  async send(payload: unknown): Promise<void> {
    const { userId, ...rest } = payload as PushMessage;
    const result = await this.deliver(userId, rest);

    if (!result.enabled) {
      throw new OutboxPermanentError('Web Push 가 꺼져 있습니다 (VAPID 키 없음).');
    }
    // 한 기기라도 갔으면 성공으로 본다 — 재시도하면 이미 받은 기기에 또 간다.
    // 보낼 기기가 없거나(구독 0) 만료 구독뿐이면 재시도할 것도 없다
    if (result.sent > 0 || result.failed === 0) return;

    throw new Error(`기기 ${result.devices}대 모두 실패 — ${result.errors.join(' / ')}`);
  }

  // 한 사용자의 모든 기기로 발송하고 결과를 센다. 만료(404/410) 구독은 정리한다
  async deliver(userId: number, payload: PushPayload): Promise<PushDelivery> {
    const result: PushDelivery = {
      enabled: this.webPush.getPublicKey().enabled,
      devices: 0,
      sent: 0,
      expired: 0,
      failed: 0,
      errors: [],
    };
    if (!result.enabled) return result;

    const subs = await this.prisma.pushSubscription.findMany({ where: { user_id: userId } });
    result.devices = subs.length;
    if (!subs.length) return result;

    await Promise.all(
      subs.map(async (s) => {
        const sent = await this.webPush.sendToSubscription(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        if (sent.ok) {
          result.sent++;
          return;
        }
        if (sent.expired) {
          result.expired++;
          await this.prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          return;
        }
        result.failed++;
        if (sent.error) result.errors.push(sent.error);
      }),
    );
    return result;
  }
}
