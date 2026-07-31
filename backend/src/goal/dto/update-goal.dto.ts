import { PartialType } from '@nestjs/swagger';
import { CreateGoalDto } from './create-goal.dto';

// 모든 필드를 선택적으로 — 부분 수정(PUT) 용
export class UpdateGoalDto extends PartialType(CreateGoalDto) {}
