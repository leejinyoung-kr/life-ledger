import { IsString, MinLength } from 'class-validator';

export class ParseLedgerDto {
  @IsString()
  @MinLength(1)
  text!: string;
}
