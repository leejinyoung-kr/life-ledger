import { Controller, Get } from '@nestjs/common';
import { Public } from '@leejinyoun/core-auth';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // 헬스/루트 — 토큰 없이 접근 허용
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
