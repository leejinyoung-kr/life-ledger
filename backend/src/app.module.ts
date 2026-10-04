import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from '@leejinyoung-kr/core-auth';
import { JobsModule } from '@leejinyoung-kr/core-jobs';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssetModule } from './asset/asset.module';
import { CategoryModule } from './category/category.module';
import { AuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { InvestmentModule } from './investment/investment.module';
import { InvestmentAccountModule } from './investment-account/investment-account.module';
import { NotificationModule } from './notification/notification.module';
import { PrismaModule } from './prisma/prisma.module';
import { SavingModule } from './saving/saving.module';
import { SecurityModule } from './security/security.module';
import { SettingsModule } from './settings/settings.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { TransactionModule } from './transaction/transaction.module';
import { SearchModule } from './search/search.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CryptoModule } from '@leejinyoung-kr/core-security';
import { IdentityModule } from './identity/identity.module';
import { CredentialModule } from './credential/credential.module';
import { EnvModule } from './env/env.module';
import { ExportModule } from './export/export.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { FileModule } from './file/file.module';
import { ConvertModule } from './convert/convert.module';
import { AccessLogModule } from './access-log/access-log.module';
import { ImportModule } from './import/import.module';
import { AiModule } from './ai/ai.module';
import { PushModule } from './push/push.module';
import { MailModule } from './mail/mail.module';
import { HealthModule } from './health/health.module';
import { SystemLogModule } from './system-log/system-log.module';
import { RecurringScheduleModule } from './recurring-schedule/recurring-schedule.module';
import { AllExceptionsFilter, MetaModule } from '@leejinyoung-kr/core-common';
import { cryptoOptions } from './crypto/crypto-options';
import { CryptoAuditModule } from './crypto/crypto-audit.module';
import { PrismaJobRunStore } from './maintenance/job-run.store';
import { JobsMetaContributor } from './meta/jobs.meta';
import { NotificationMetaContributor } from './meta/notification.meta';
import { OutboxMetaContributor } from './meta/outbox.meta';
import { env } from './config/env';

@Module({
  imports: [
    // 예약 작업(@Job, maintenance/) — 실행 기록은 job_run, 실패는 시스템 로그에도 남긴다.
    // lease 안에 끝나지 않거나 프로세스가 죽어 끝을 기록하지 못한 실행은 failed(lease_expired)로 마감된다
    JobsModule.forRoot({ store: PrismaJobRunStore, imports: [SystemLogModule], timeZone: 'Asia/Seoul' }),
    // GET /_meta — 지금 무엇이 돌고 있는지(빌드 커밋·코어 패키지 버전 + 예약 작업·아웃박스·알림 채널).
    // 전역 JwtAuthGuard 를 그대로 받으므로 로그인해야 보인다(@Public 아님)
    MetaModule.forRoot({
      commit: env.GIT_COMMIT,
      contributors: [JobsMetaContributor, OutboxMetaContributor, NotificationMetaContributor],
      imports: [PrismaModule, PushModule],
    }),
    // 기본 분당 120요청(IP) — 민감 엔드포인트는 @Throttle 로 더 엄격히 제한
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    AccessLogModule,
    AuthModule,
    TransactionModule,
    SavingModule,
    InvestmentAccountModule,
    InvestmentModule,
    SubscriptionModule,
    AssetModule,
    SettingsModule,
    NotificationModule,
    CalendarModule,
    SecurityModule,
    CategoryModule,
    SearchModule,
    DashboardModule,
    // 키링(CRYPTO_KEYS) + v1 읽기용 CREDENTIAL_SECRET. 키 설정이 틀리면 여기서 부팅이 멈춘다
    CryptoModule.forRoot(cryptoOptions()),
    // 부팅 시 암호문 점검 + 현재 키가 아닌 암호문 자동 재암호화
    CryptoAuditModule,
    IdentityModule,
    CredentialModule,
    EnvModule,
    ExportModule,
    MaintenanceModule,
    FileModule,
    ConvertModule,
    ImportModule,
    AiModule,
    PushModule,
    MailModule,
    HealthModule,
    SystemLogModule,
    RecurringScheduleModule,
  ],
  controllers: [AppController],
  // 전역 가드 — 요청량 제한(Throttler) 후 JWT 인증. @Public() 핸들러만 토큰 예외
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
