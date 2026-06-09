import { IsObject, IsString } from 'class-validator';

// 브라우저 PushSubscription.toJSON() 구조 그대로 받는다
export class SubscribeDto {
  @IsString()
  endpoint!: string;

  @IsObject()
  keys!: { p256dh: string; auth: string };
}

export class UnsubscribeDto {
  @IsString()
  endpoint!: string;
}
