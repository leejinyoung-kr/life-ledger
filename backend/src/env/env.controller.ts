import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VaultGuard } from '../security/vault.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { Client, type ClientInfo } from '../common/client-info.decorator';
import {
  BulkEnvDto,
  CreateEnvProjectDto,
  CreateEnvVarDto,
  UpdateEnvProjectDto,
  UpdateEnvVarDto,
} from './dto/env.dto';
import type { EnvKindDto } from './dto/env.dto';
import { EnvService } from './env.service';

@ApiTags('ENV 보관함')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class EnvController {
  constructor(private readonly service: EnvService) {}

  // 프로젝트 목록
  @Get('env-projects')
  findProjects(@CurrentUser() user: AuthUser) {
    return this.service.findProjects(user.id);
  }

  // 프로젝트 추가
  @Post('env-projects')
  createProject(@CurrentUser() user: AuthUser, @Body() dto: CreateEnvProjectDto) {
    return this.service.createProject(user.id, dto);
  }

  // 프로젝트 수정
  @Put('env-projects/:id')
  updateProject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEnvProjectDto,
  ) {
    return this.service.updateProject(user.id, id, dto);
  }

  // 프로젝트 삭제
  @Delete('env-projects/:id')
  removeProject(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.removeProject(user.id, id);
  }

  // 프로젝트·환경별 변수 목록
  @Get('env-projects/:id/vars')
  findVars(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('env') env: EnvKindDto,
  ) {
    return this.service.findVars(user.id, id, env);
  }

  // 두 환경 변수 비교(diff)
  @Get('env-projects/:id/diff')
  diff(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('base') base: EnvKindDto,
    @Query('target') target: EnvKindDto,
  ) {
    return this.service.diff(user.id, id, base, target);
  }

  // 프로젝트·환경 변수 원문 내보내기 (.env 복사/다운로드)
  @Get('env-projects/:id/export')
  exportVars(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('env') env: EnvKindDto,
  ) {
    return this.service.exportVars(user.id, id, env);
  }

  // 변수 추가 (선택 환경마다 생성)
  @Post('env-projects/:id/vars')
  createVar(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateEnvVarDto,
  ) {
    return this.service.createVar(user.id, id, dto);
  }

  // .env 텍스트 일괄 저장
  @Post('env-projects/:id/bulk')
  bulkUpsert(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BulkEnvDto,
  ) {
    return this.service.bulkUpsert(user.id, id, dto);
  }

  // 변수 값 원문 조회 (표시/복사). 마스터 잠금 시 VaultGuard 통과 필요. 분당 20회 제한
  @Get('env-vars/:id/reveal')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(VaultGuard)
  revealVar(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Client() client: ClientInfo) {
    return this.service.revealVar(user.id, id, client);
  }

  // 변수 수정
  @Put('env-vars/:id')
  updateVar(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEnvVarDto,
  ) {
    return this.service.updateVar(user.id, id, dto);
  }

  // 변수 값 변경 이력 (마스킹)
  @Get('env-vars/:id/history')
  varHistory(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.varHistory(user.id, id);
  }

  // 이력 값으로 롤백
  @Post('env-vars/:id/rollback/:historyId')
  rollbackVar(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('historyId', ParseIntPipe) historyId: number,
  ) {
    return this.service.rollbackVar(user.id, id, historyId);
  }

  // 변수 일괄 삭제
  @Delete('env-vars/bulk')
  removeVarMany(@CurrentUser() user: AuthUser, @Body('ids') ids: number[]) {
    return this.service.removeVarMany(user.id, ids);
  }

  // 변수 삭제
  @Delete('env-vars/:id')
  removeVar(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.removeVar(user.id, id);
  }
}
