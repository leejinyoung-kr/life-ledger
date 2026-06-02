import { PartialType } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto';

// 모든 필드를 선택적으로 — 부분 수정(PUT) + 완료 토글({done}) 용
export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
