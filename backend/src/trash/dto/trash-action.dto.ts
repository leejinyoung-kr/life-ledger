import { IsIn, IsInt } from 'class-validator';

const KINDS = [
  'transaction', 'saving', 'investment', 'subscription',
  'asset', 'task', 'goal', 'note', 'calendar',
];

// 복구/영구삭제 대상 지정 (종류 + id)
export class TrashActionDto {
  @IsIn(KINDS)
  kind: string;

  @IsInt()
  id: number;
}
