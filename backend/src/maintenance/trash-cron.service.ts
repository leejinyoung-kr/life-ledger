import { Injectable } from '@nestjs/common';
import { Job } from '@leejinyoung-kr/core-jobs';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TrashCronService {
  constructor(private prisma: PrismaService) {}

  // 매일 새벽 3시 — soft-delete 후 30일 경과 항목 영구 삭제 + 시스템 로그·작업 실행 기록·끝난 알림 발송 90일 경과분 정리.
  // 테이블 하나가 실패해도 나머지는 계속 지우고, 끝에 실패를 모아 던져 실행 기록에 실패로 남긴다
  @Job({ name: 'trash-purge', cron: '0 3 * * *', leaseMs: 10 * 60_000 })
  async purgeExpired(): Promise<string> {
    const cutoff = new Date(Date.now() - 30 * DAY_MS);
    const where = { deleted_at: { lt: cutoff } } as const;
    const failures: string[] = [];
    let trash = 0;

    // 독립 테이블 (user FK 만) — 개별 삭제
    const simple: [string, () => Promise<{ count: number }>][] = [
      ['transaction', () => this.prisma.transaction.deleteMany({ where })],
      ['saving', () => this.prisma.saving.deleteMany({ where })],
      ['investment', () => this.prisma.investment.deleteMany({ where })],
      ['subscription', () => this.prisma.subscription.deleteMany({ where })],
      ['calendar_event', () => this.prisma.calendarEvent.deleteMany({ where })],
      ['identity_card', () => this.prisma.identityCard.deleteMany({ where })],
      ['credential', () => this.prisma.credential.deleteMany({ where })],
    ];
    for (const [table, del] of simple) {
      try { trash += (await del()).count; } catch (e) { failures.push(`${table}: ${(e as Error).message}`); }
    }

    // ENV: 변수(FK) 먼저 정리 후 프로젝트 — 만료 프로젝트의 잔여 변수까지 제거
    try {
      trash += (await this.prisma.envVar.deleteMany({ where })).count;
      const oldProjects = await this.prisma.envProject.findMany({ where, select: { id: true } });
      const ids = oldProjects.map((p) => p.id);
      if (ids.length) {
        await this.prisma.envVar.deleteMany({ where: { project_id: { in: ids } } });
        trash += (await this.prisma.envProject.deleteMany({ where: { id: { in: ids } } })).count;
      }
    } catch (e) {
      failures.push(`env: ${(e as Error).message}`);
    }

    // 시스템 로그·작업 실행 기록 90일 경과분 — 실행 중인 기록은 lease 마감 대상이라 남긴다
    const logCutoff = new Date(Date.now() - 90 * DAY_MS);
    let logs = 0;
    let runs = 0;
    try {
      logs = (await this.prisma.systemLog.deleteMany({ where: { created_at: { lt: logCutoff } } })).count;
    } catch (e) {
      failures.push(`system_log: ${(e as Error).message}`);
    }
    try {
      runs = (await this.prisma.jobRun.deleteMany({
        where: { started_at: { lt: logCutoff }, status: { not: 'running' } },
      })).count;
    } catch (e) {
      failures.push(`job_run: ${(e as Error).message}`);
    }
    // 끝난 알림 발송분 — 대기·발송 중인 행은 아직 나갈 것이라 남긴다
    let outbox = 0;
    try {
      outbox = (await this.prisma.outboxMessage.deleteMany({
        where: { created_at: { lt: logCutoff }, status: { in: ['sent', 'failed'] } },
      })).count;
    } catch (e) {
      failures.push(`outbox_message: ${(e as Error).message}`);
    }

    const summary = `휴지통 ${trash}건(30일 경과)·시스템 로그 ${logs}건·실행 기록 ${runs}건·알림 발송 ${outbox}건(90일 경과) 삭제`;
    if (failures.length) throw new Error(`${summary} — 실패 ${failures.length}곳: ${failures.join(' / ')}`);
    return summary;
  }
}
