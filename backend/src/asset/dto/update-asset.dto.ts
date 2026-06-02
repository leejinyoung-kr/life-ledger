import { PartialType } from '@nestjs/swagger';
import { CreateAssetDto } from './create-asset.dto';

// 모든 필드를 선택적으로 — 부분 수정(PUT) 용
export class UpdateAssetDto extends PartialType(CreateAssetDto) {}
