import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

// 요청별 상관관계 ID 부여 + 구조화 접근로그.
// main.ts 에서 app.use(requestLogger) 로 함수형 전역 등록한다(@Module forRoutes('*') 경유 시
// Express 5 + path-to-regexp 8 환경에서 'Missing parameter name' 부팅 실패 가능).
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const headerRid = req.headers['x-request-id'];
  const rid = (Array.isArray(headerRid) ? headerRid[0] : headerRid) || randomUUID();
  req.requestId = rid;
  res.setHeader('x-request-id', rid);

  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const line = `${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms rid=${rid}`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.log(line);
  });

  next();
}
