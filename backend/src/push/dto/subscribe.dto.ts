import { IsObject, IsOptional, IsString } from 'class-validator';

// 브라우저 PushSubscription.toJSON() 구조 그대로 받는다
export class SubscribeDto {
  @IsString()
  endpoint!: string;

  // toJSON()이 항상 포함하는 필드(보통 null) — forbidNonWhitelisted 통과용
  @IsOptional()
  expirationTime?: number | null;

  @IsObject()
  keys!: { p256dh: string; auth: string };
}

export class UnsubscribeDto {
  @IsString()
  endpoint!: string;
}
