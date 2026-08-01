import { Injectable } from '@nestjs/common';
import { Prisma, UserSettings } from '@prisma/client';
import type { AuthUser } from '../auth/auth-user';
import { CryptoService } from '@leejinyoun/core-security';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { DEFAULT_CATEGORIES, DEFAULT_WIDGETS } from './settings.defaults';

// API 키 노출 최소화 — 앞 7자만 남기고 마스킹 (복호화된 평문 기준)
function maskKey(key: string): string {
  return `${key.slice(0, 7)}••••`;
}

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  // 저장된 OpenAI 키 복호화 — 신규는 'v1:' 암호문, 구버전 평문 행은 그대로 반환(하위호환)
  // CREDENTIAL_SECRET 변경/데이터 손상으로 복호화 실패 시에도 /settings 조회 전체가 죽지 않도록 null 반환
  private revealOpenAiKey(stored: string): string | null {
    if (!stored.startsWith('v1:')) return stored;
    try {
      return this.crypto.decrypt(stored);
    } catch {
      return null;
    }
  }

  // 설정 행 조회, 없으면 기본값으로 생성 (1:1 보장)
  private async getOrCreate(userId: number): Promise<UserSettings> {
    const existing = await this.prisma.userSettings.findUnique({ where: { user_id: userId } });
    if (existing) return existing;
    return this.prisma.userSettings.create({
      data: {
        user_id: userId,
        categories: DEFAULT_CATEGORIES,
        widgets: DEFAULT_WIDGETS,
      },
    });
  }

  // 복호화된 키를 마스킹 — 복호화 실패(키 손상/시크릿 변경) 시 마스킹 텍스트로 대체
  private maskedOpenAiKey(stored: string): string {
    const revealed = this.revealOpenAiKey(stored);
    return revealed ? maskKey(revealed) : '복호화 실패';
  }

  // 엔티티 → 응답 DTO. user(토큰)에서 계정 정보, 설정행에서 선호값. API 키는 마스킹.
  private toDto(s: UserSettings, user: AuthUser) {
    return {
      user: { email: user.email, name: user.name, picture: user.picture },
      displayName: s.display_name ?? user.name,
      notifMonthly: s.notif_monthly,
      notifUpload: s.notif_upload,
      notifMaturity: s.notif_maturity,
      notifDeadline: s.notif_deadline,
      showHolidays: s.show_holidays,
      sessionExpiry: s.session_expiry,
      pwAutoHide: s.pw_auto_hide,
      openaiApiKeySet: !!s.openai_api_key,
      openaiApiKeyMasked: s.openai_api_key ? this.maskedOpenAiKey(s.openai_api_key) : null,
      openaiModel: s.openai_model,
      categories: s.categories,
      widgets: s.widgets,
      menuOrder: s.menu_order ?? null,
    };
  }

  // 설정 조회 (없으면 기본값 생성 후 반환)
  async get(user: AuthUser) {
    const row = await this.getOrCreate(user.id);
    return this.toDto(row, user);
  }

  // 설정 부분 수정 — 전달된 필드만 반영. openaiApiKey 는 빈 값이면 기존 키 유지
  async update(user: AuthUser, dto: UpdateSettingsDto) {
    await this.getOrCreate(user.id);

    const data: Prisma.UserSettingsUpdateInput = {
      display_name: dto.displayName,
      notif_monthly: dto.notifMonthly,
      notif_upload: dto.notifUpload,
      notif_maturity: dto.notifMaturity,
      notif_deadline: dto.notifDeadline,
      show_holidays: dto.showHolidays,
      session_expiry: dto.sessionExpiry,
      pw_auto_hide: dto.pwAutoHide,
      openai_model: dto.openaiModel,
      categories: dto.categories as Prisma.InputJsonValue,
      widgets: dto.widgets as Prisma.InputJsonValue,
      menu_order: dto.menuOrder as Prisma.InputJsonValue,
    };
    // 새 키가 입력됐을 때만 교체 (빈 문자열/미전송 시 기존 유지). AES-256-GCM 으로 암호화 저장
    if (dto.openaiApiKey) data.openai_api_key = this.crypto.encrypt(dto.openaiApiKey);

    const updated = await this.prisma.userSettings.update({
      where: { user_id: user.id },
      data,
    });
    return this.toDto(updated, user);
  }
}
