import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { AiService } from './ai.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ParseLedgerDto } from './dto/parse-ledger.dto';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly service: AiService) {}

  // 자연어 → 가계부 거래 초안 파싱
  @ApiOperation({ summary: 'AI 자연어 → 가계부 거래 파싱' })
  // OpenAI 유료 호출 — Denial-of-Wallet 방지 위해 분당 10회 제한
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('parse-transaction')
  parseTransaction(@CurrentUser() user: AuthUser, @Body() dto: ParseLedgerDto) {
    return this.service.parseLedgerEntry(user.id, dto.text);
  }

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
  generateReport(@CurrentUser() user: AuthUser, @Body() dto: GenerateReportDto) {
    return this.service.generateReport(user.id, dto.period);
  }
}
