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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';
import { CredentialService } from './credential.service';

@ApiTags('계정 보관함')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('credentials')
export class CredentialController {
  constructor(private readonly service: CredentialService) {}

  // 계정 목록
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.id);
  }

  // 비밀번호·TOTP 원문 조회 (표시/복사)
  @Get(':id/reveal')
  reveal(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.reveal(user.id, id);
  }

  // 계정 추가
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCredentialDto) {
    return this.service.create(user.id, dto);
  }

  // 계정 수정
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCredentialDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 계정 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
