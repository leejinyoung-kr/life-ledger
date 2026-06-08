import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// 접근 감사 로그용 클라이언트 정보 (IP·User-Agent)
export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

// 프록시(x-forwarded-for) 우선으로 IP 추출, User-Agent 동봉. 길이는 컬럼 한도에 맞춰 절단
export const Client = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClientInfo => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const fwd = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0]) ?? req.ip ?? undefined;
    const ua = req.headers['user-agent'];
    return {
      ip: ip?.trim().slice(0, 60),
      userAgent: typeof ua === 'string' ? ua.slice(0, 300) : undefined,
    };
  },
);
