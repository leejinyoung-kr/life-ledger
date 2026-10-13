import { Injectable } from '@nestjs/common';
import { Prisma, UserSettings } from '@prisma/client';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { DEFAULT_CATEGORIES } from './settings.defaults';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // 설정 행 조회, 없으면 기본값으로 생성 (1:1 보장)
  private async getOrCreate(userId: number): Promise<UserSettings> {
    const existing = await this.prisma.userSettings.findUnique({ where: { user_id: userId } });
    if (existing) return existing;
    return this.prisma.userSettings.create({
      data: {
        user_id: userId,
        categories: DEFAULT_CATEGORIES,
      },
    });
  }

  // 엔티티 → 응답 DTO. user(토큰)에서 계정 정보, 설정행에서 선호값.
  private toDto(s: UserSettings, user: AuthUser) {
    return {
      user: { email: user.email, name: user.name, picture: user.picture },
      displayName: s.display_name ?? user.name,
      notifUpload: s.notif_upload,
      notifMaturity: s.notif_maturity,
      notifDeadline: s.notif_deadline,
      showHolidays: s.show_holidays,
      sessionExpiry: s.session_expiry,
      pwAutoHide: s.pw_auto_hide,
      categories: s.categories,
    };
  }

  // 설정 조회 (없으면 기본값 생성 후 반환)
  async get(user: AuthUser) {
    const row = await this.getOrCreate(user.id);
    return this.toDto(row, user);
  }

  // 설정 부분 수정 — 전달된 필드만 반영
  async update(user: AuthUser, dto: UpdateSettingsDto) {
    await this.getOrCreate(user.id);

    const data: Prisma.UserSettingsUpdateInput = {
      display_name: dto.displayName,
      notif_upload: dto.notifUpload,
      notif_maturity: dto.notifMaturity,
      notif_deadline: dto.notifDeadline,
      show_holidays: dto.showHolidays,
      session_expiry: dto.sessionExpiry,
      pw_auto_hide: dto.pwAutoHide,
      categories: dto.categories as Prisma.InputJsonValue,
    };
    const updated = await this.prisma.userSettings.update({
      where: { user_id: user.id },
      data,
    });
    return this.toDto(updated, user);
  }
}
