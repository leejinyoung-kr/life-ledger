import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssetModule } from './asset/asset.module';
import { CategoryModule } from './category/category.module';
import { AuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { InvestmentModule } from './investment/investment.module';
import { NoteModule } from './note/note.module';
import { NotificationModule } from './notification/notification.module';
import { PrismaModule } from './prisma/prisma.module';
import { SavingModule } from './saving/saving.module';
import { SecurityModule } from './security/security.module';
import { SettingsModule } from './settings/settings.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { TaskModule } from './task/task.module';
import { TrashModule } from './trash/trash.module';
import { TransactionModule } from './transaction/transaction.module';
import { SearchModule } from './search/search.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CryptoModule } from './common/crypto.module';
import { IdentityModule } from './identity/identity.module';
import { CredentialModule } from './credential/credential.module';
import { EnvModule } from './env/env.module';
import { ExportModule } from './export/export.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { FileModule } from './file/file.module';
import { AccessLogModule } from './access-log/access-log.module';
import { ImportModule } from './import/import.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // 기본 분당 120요청(IP) — 민감 엔드포인트는 @Throttle 로 더 엄격히 제한
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    AccessLogModule,
    AuthModule,
    TransactionModule,
    SavingModule,
    InvestmentModule,
    SubscriptionModule,
    AssetModule,
    SettingsModule,
    NotificationModule,
    TaskModule,
    NoteModule,
    CalendarModule,
    TrashModule,
    SecurityModule,
    CategoryModule,
    SearchModule,
    DashboardModule,
    CryptoModule,
    IdentityModule,
    CredentialModule,
    EnvModule,
    ExportModule,
    MaintenanceModule,
    FileModule,
    ImportModule,
    AiModule,
  ],
  controllers: [AppController],
  // 전역 가드 — 요청량 제한(Throttler) 후 JWT 인증. @Public() 핸들러만 토큰 예외
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
