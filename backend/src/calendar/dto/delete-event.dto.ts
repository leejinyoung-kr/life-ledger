import { IsDateString, IsOptional } from 'class-validator';

export class DeleteEventDto {
  // 삭제할 발생일 (YYYY-MM-DD). 반복 일정에서 특정 회차를 클릭해 삭제할 때 전달 —
  // 이 날짜부터(포함) 이후 발생만 중단하고, 이전 발생들은 유지한다. 미지정 시 전체(과거 포함) 삭제.
  @IsOptional()
  @IsDateString()
  occurrenceDate?: string;
}
