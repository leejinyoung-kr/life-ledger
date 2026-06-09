import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

// 푸시 페이로드 — 민감정보 금지(제목/요약만). 상세는 앱을 열어 확인하게 한다.
export interface PushPayload {
  title: string;
  body: string;
  url?: string; // 클릭 시 이동 경로 (기본 /notifications)
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;
  private publicKey: string | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // 부팅 시 VAPID 키 유무로 활성화 결정 — 키 없으면 발송 기능 전체 비활성(no-op)
  onModuleInit(): void {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:admin@docnexus.local';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.publicKey = publicKey;
      this.enabled = true;
      this.logger.log('Web Push 활성화됨 (VAPID 키 감지)');
    } else {
      this.logger.warn('VAPID 키 없음 — Web Push 비활성 (구독/발송 no-op)');
    }
  }

  // 프론트가 구독 전 공개키를 받아간다. 비활성이면 enabled=false 만 반환
  getPublicKey(): { enabled: boolean; publicKey: string | null } {
    return { enabled: this.enabled, publicKey: this.publicKey };
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

  // 한 사용자의 모든 기기로 푸시 발송 — 비활성이면 즉시 반환(no-op). 만료(404/410) 구독은 정리
  async sendToUser(userId: number, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;

    const subs = await this.prisma.pushSubscription.findMany({ where: { user_id: userId } });
    if (!subs.length) return;

    const data = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            data,
          );
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // 만료/폐기된 구독은 삭제, 그 외는 로깅만
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          } else {
            this.logger.warn(`푸시 발송 실패 (sub ${s.id}, status ${status ?? '?'})`);
          }
        }
      }),
    );
  }
}
