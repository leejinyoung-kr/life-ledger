import {
  RecurringKind,
  TransactionType,
  TransferTarget,
} from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

// 자동이체(반복 자동 생성) 설정 추가 — kind에 따라 거래/투자 전용 필드가 갈린다
export class CreateRecurringScheduleDto {
  @IsEnum(RecurringKind)
  kind: RecurringKind;

  // 반복 규칙 — cycle(주기)/day(기준일)/month(연간 전용)/weekendAdjust(주말 처리)
  @IsObject()
  rule: Record<string, unknown>;

  // 최초 실행 기준일
  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  // ── kind=transaction 전용 ──
  @ValidateIf((o: CreateRecurringScheduleDto) => o.kind === 'transaction')
  @IsEnum(TransactionType)
  txType?: TransactionType;

  @ValidateIf((o: CreateRecurringScheduleDto) => o.kind === 'transaction')
  @IsString()
  @MaxLength(200)
  title?: string;

  @ValidateIf((o: CreateRecurringScheduleDto) => o.kind === 'transaction')
  @IsString()
  @MaxLength(50)
  category?: string;

  @ValidateIf((o: CreateRecurringScheduleDto) => o.kind === 'transaction')
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  payMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;

  // 자산이동 누적 대상 종류 — txType='transfer'일 때만 의미, targetId와 함께 지정해야 자동 반영됨
  @ValidateIf((o: CreateRecurringScheduleDto) => o.targetId !== undefined)
  @IsEnum(TransferTarget)
  targetType?: TransferTarget;

  @ValidateIf((o: CreateRecurringScheduleDto) => o.targetType !== undefined)
  @IsInt()
  targetId?: number;

  // ── kind=investment 전용 ──
  @ValidateIf((o: CreateRecurringScheduleDto) => o.kind === 'investment')
  @IsInt()
  investmentId?: number;

  // 회차당 매수금액(국내: 원, 해외: 달러) — buyQuantity와 동시 사용 불가
  @IsOptional()
  @IsNumber()
  buyAmount?: number;

  // 회차당 매수수량(주) — buyAmount와 동시 사용 불가, 둘 중 하나만 입력
  @IsOptional()
  @IsNumber()
  buyQuantity?: number;
}
