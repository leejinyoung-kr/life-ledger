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
import { CreateNoteDto } from './dto/create-note.dto';
import { NoteService } from './note.service';
import { UpdateNoteDto } from './dto/update-note.dto';

@ApiTags('메모')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NoteController {
  constructor(private readonly service: NoteService) {}

  // 메모 목록
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.id);
  }

  // 메모 추가
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateNoteDto) {
    return this.service.create(user.id, dto);
  }

  // 메모 수정
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 메모 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
