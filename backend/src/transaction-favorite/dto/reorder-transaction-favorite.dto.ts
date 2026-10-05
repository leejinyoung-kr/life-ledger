import { ArrayMaxSize, IsArray, IsInt } from 'class-validator';

export class ReorderTransactionFavoriteDto {
  // 새 표시 순서대로 나열한 즐겨찾기 id
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  ids: number[];
}
