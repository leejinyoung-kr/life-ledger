import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// 전역 예외 필터 — 처리 안 된 예외를 일관된 JSON으로 변환.
// HttpException 외(예: 런타임 에러)는 500으로 마스킹해 스택트레이스 누출 방지.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // HttpException 메시지는 그대로 노출, 그 외는 일반 문구로 마스킹
    let message: string | object = '서버 오류가 발생했습니다.';
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : ((body as { message?: unknown }).message ?? body);
    }

    const rid = req.requestId;

    // 5xx는 원본 예외 로깅(관측), 4xx는 노이즈라 미로깅
    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status} rid=${rid}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
      requestId: rid,
    });
  }
}
