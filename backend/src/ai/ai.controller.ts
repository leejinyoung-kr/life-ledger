import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
  @Post('parse-transaction')
  parseTransaction(@CurrentUser() user: AuthUser, @Body() dto: ParseLedgerDto) {
    return this.service.parseLedgerEntry(user.id, dto.text);
  }

  // 저장된 AI 리포트 목록
  @ApiOperation({ summary: '저장된 AI 리포트 목록 조회' })
  @Get('reports')
  listReports(@CurrentUser() user: AuthUser) {
    return this.service.listReports(user.id);
  }

  // 기간 분석 → AI 리포트 생성
  @ApiOperation({ summary: 'AI 리포트 생성 (기간별 가계부 분석)' })
  @Post('reports')
  generateReport(@CurrentUser() user: AuthUser, @Body() dto: GenerateReportDto) {
    return this.service.generateReport(user.id, dto.period);
  }
}
