import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @MaxLength(200)
  name: string;

  // null = 루트, 숫자 = 부모 폴더 id
  @IsOptional()
  @IsInt()
  parentId?: number | null;
}

export class MoveFileDto {
  @IsOptional()
  @IsInt()
  folderId: number | null;
}
