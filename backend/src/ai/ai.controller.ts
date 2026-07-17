import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@leejinyoun/core-auth';
import { JwtAuthGuard } from '@leejinyoun/core-auth';
import type { AuthUser } from '../auth/auth-user';
import { AiService } from './ai.service';
import { GenerateReportDto } from './dto/generate-report.dto';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly service: AiService) {}

  // 저장된 OpenAI 키 연결 확인
  @ApiOperation({ summary: 'OpenAI API 키 연결 확인' })
  // 외부 호출 — 분당 10회 제한
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-key')
  verifyKey(@CurrentUser() user: AuthUser) {
    return this.service.verifyApiKey(user.id);
  }

  // 이번 달 AI 사용량 집계
  @ApiOperation({ summary: '이번 달 AI 사용량 조회 (토큰·비용)' })
  @Get('usage')
  usage(@CurrentUser() user: AuthUser) {
    return this.service.getUsageSummary(user.id);
  }

  // 저장된 AI 리포트 목록
  @ApiOperation({ summary: '저장된 AI 리포트 목록 조회' })
  @Get('reports')
  listReports(@CurrentUser() user: AuthUser) {
    return this.service.listReports(user.id);
  }

  // 기간 분석 → AI 리포트 생성
  @ApiOperation({ summary: 'AI 리포트 생성 (기간별 가계부 분석)' })
  // 가장 비싼 OpenAI 호출(긴 프롬프트) — 분당 5회로 엄격 제한
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reports')
  generateReport(
    @CurrentUser() user: AuthUser,
    @Body() dto: GenerateReportDto,
  ) {
    return this.service.generateReport(user.id, dto.period);
  }
}
