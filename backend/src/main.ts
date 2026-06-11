import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { requestLogger } from './common/request-logger.middleware';

async function bootstrap() {
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
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('DocNexus API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
