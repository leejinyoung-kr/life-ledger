import { IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// 브라우저 푸시 서비스 endpoint 만 허용 — 임의 URL 을 받으면 서버가 그 주소로 요청을 보내게 된다(SSRF).
// Chrome(FCM)·Firefox(Mozilla)·Edge(WNS)·Safari(Apple). https + 포트 없이 호스트 바로 뒤가 경로여야 한다
export const PUSH_ENDPOINT_PATTERN =
  /^https:\/\/(?:fcm\.googleapis\.com|(?:[a-z0-9-]+\.)+push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com|(?:[a-z0-9-]+\.)*push\.apple\.com)\//i;

// 브라우저 PushSubscription.toJSON() 구조 그대로 받는다
export class SubscribeDto {
  @IsString()
  @MaxLength(1000)
  @Matches(PUSH_ENDPOINT_PATTERN, { message: '지원하지 않는 푸시 서비스 주소입니다.' })
  endpoint!: string;

  // toJSON()이 항상 포함하는 필드(보통 null) — forbidNonWhitelisted 통과용
  @IsOptional()
  expirationTime?: number | null;

  @IsObject()
  keys!: { p256dh: string; auth: string };
}

export class UnsubscribeDto {
  @IsString()
  @MaxLength(1000)
  endpoint!: string;
}
