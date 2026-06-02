import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Bearer JWT 검증 가드. 보호가 필요한 컨트롤러/핸들러에 @UseGuards(JwtAuthGuard) 로 부착
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
