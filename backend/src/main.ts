// 환경변수 로드·검증은 config/env 를 import 하는 순간 끝난다(실패 시 틀린 키 전부 출력 후 부팅 중단).
// 맨 위에 두는 건 process.env 를 직접 읽는 서드파티를 위한 것일 뿐, 우리 코드는 import 순서에 기대지 않는다
import { env } from './config/env';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { describeEnv } from '@leejinyoung-kr/core-config';
import { AppModule } from './app.module';
import { requestLogger } from '@leejinyoung-kr/core-logging';
import { configureOutboundNetwork } from './config/network';

async function bootstrap() {
  // 외부 연결(B2 등) 주소당 대기 시간 — 기본 250ms 로는 홈서버→B2 연결이 끊겨 업로드가 실패한다
  configureOutboundNetwork();
  // 유효 설정을 부팅 로그에 남긴다 — 시크릿·URL 비밀번호는 가리고, 꺼진 기능은 (미설정)으로 드러난다
  new Logger('Config').log(`유효 설정:\n${describeEnv(env)}`);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 신뢰 프록시 — 리버스 프록시 뒤에서 x-forwarded-for 의 첫 값을 client IP 로 사용.
  // throttler 키·새 기기 감지·접근로그 IP 정확도에 필요. 직접 노출 시 TRUST_PROXY 미설정으로 무효.
  const trustProxy = env.TRUST_PROXY;
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

  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    // 변환 결과 다운로드 시 프론트가 실제 파일명(확장자 포함)을 읽을 수 있도록 노출.
    // X-Skipped-Locked 는 파일 보관함 ZIP 에서 잠겨서 빠진 파일 수
    exposedHeaders: ['Content-Disposition', 'X-Skipped-Locked'],
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.setGlobalPrefix('api/v1');

  // Swagger 는 비운영 환경에서만 노출 — 운영에선 전체 API 표면 정보 노출 차단
  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('DocNexus API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);
  }

  await app.listen(env.PORT);
}
bootstrap();
