import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 보안 헤더 — CSP/HSTS/X-Frame-Options 등. API+Swagger 호환 위해 CSP는 비활성
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());

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
