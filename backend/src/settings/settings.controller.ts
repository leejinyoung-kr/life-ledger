import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@leejinyoun/core-auth';
import { JwtAuthGuard } from '@leejinyoun/core-auth';
import type { AuthUser } from '../auth/auth-user';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('설정')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  // 설정 조회 (계정 정보 + 선호값)
  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.service.get(user);
  }

  // 설정 부분 수정
  @Put()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.service.update(user, dto);
  }
}
