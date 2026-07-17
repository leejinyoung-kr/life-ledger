// AppModule(및 그 안에서 import되는 다른 모듈 파일들)이 로드되는 시점에 process.env.*를
// 직접 읽는 코드가 있어, ConfigModule.forRoot()보다 먼저 .env가 로드되어 있어야 한다.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { requestLogger } from './common/request-logger.middleware';

// 부팅 시 핵심 시크릿 검증 — 미설정/약함/placeholder 기본값이면 즉시 종료.
// 약한 시크릿으로 운영 배포되는 것을 막는다(런타임 500 으로 미루지 않음).
function validateSecrets() {
  const PLACEHOLDERS = new Set([
    'your_super_secret_jwt_key_change_this',
    'change_this_to_a_long_random_secret',
    'change_this_to_a_strong_password',
  ]);
  const required = ['JWT_SECRET', 'CREDENTIAL_SECRET'];
  const errors: string[] = [];
  for (const name of required) {
    const v = process.env[name];
    if (!v) {
      errors.push(`${name} 미설정`);
    } else if (v.length < 32) {
      errors.push(`${name} 너무 짧음(32자 이상 필요, 현재 ${v.length})`);
    } else if (PLACEHOLDERS.has(v)) {
      errors.push(`${name} 가 예시 기본값 그대로임 — 고유 랜덤값으로 교체 필요`);
    }
  }
  if (errors.length) {
    // 부팅 중단 — 운영 환경에 약한 시크릿 노출 방지
    throw new Error(`[보안] 시크릿 검증 실패:\n  - ${errors.join('\n  - ')}`);
  }
}

async function bootstrap() {
  validateSecrets();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 신뢰 프록시 — 리버스 프록시 뒤에서 x-forwarded-for 의 첫 값을 client IP 로 사용.
  // throttler 키·새 기기 감지·접근로그 IP 정확도에 필요. 직접 노출 시 TRUST_PROXY 미설정으로 무효.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    // 숫자(홉 수) 또는 'true'/CIDR 문자열 허용
    app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }
  // 보안 헤더 — CSP/HSTS/X-Frame-Options 등. API+Swagger UI(api-docs) 호환을 위해
  // script/style 은 'unsafe-inline' 허용, 그 외는 'self' 로 제한
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(cookieParser());
  // request-id 부여 + 구조화 접근로그 (함수형 전역 등록 — forRoutes('*') 금지)
  app.use(requestLogger);

  const allowedOrigins = (
    process.env.CORS_ORIGINS ?? 'http://localhost:3000'
  ).split(',');
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    // 변환 결과 다운로드 시 프론트가 실제 파일명(확장자 포함)을 읽을 수 있도록 노출
    exposedHeaders: ['Content-Disposition'],
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.setGlobalPrefix('api/v1');

  // Swagger 는 비운영 환경에서만 노출 — 운영에선 전체 API 표면 정보 노출 차단
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('DocNexus API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);
  }

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
