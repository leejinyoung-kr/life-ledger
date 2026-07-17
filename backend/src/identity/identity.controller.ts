import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@leejinyoun/core-auth';
import { JwtAuthGuard } from '@leejinyoun/core-auth';
import { VaultGuard } from '../security/vault.guard';
import type { AuthUser } from '../auth/auth-user';
import { Client, type ClientInfo } from '@leejinyoun/core-logging';
import { CreateIdentityDto } from './dto/create-identity.dto';
import { UpdateIdentityDto } from './dto/update-identity.dto';
import { IdentityService } from './identity.service';

@ApiTags('신원 지갑')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('identities')
export class IdentityController {
  constructor(private readonly service: IdentityService) {}

  // 신원 문서 목록
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.id);
  }

  // 번호 원문 조회 (표시 토글). 마스터 잠금 시 VaultGuard 통과 필요. 분당 20회 제한
  @Get(':id/reveal')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(VaultGuard)
  reveal(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Client() client: ClientInfo) {
    return this.service.reveal(user.id, id, client);
  }

  // 신원 문서 추가
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateIdentityDto) {
    return this.service.create(user.id, dto);
  }

  // 신원 문서 수정
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIdentityDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 신원 문서 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
