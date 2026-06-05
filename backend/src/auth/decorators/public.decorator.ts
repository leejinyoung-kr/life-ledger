import { SetMetadata } from '@nestjs/common';

// 전역 JwtAuthGuard 를 우회(토큰 없이 접근 허용)할 핸들러/컨트롤러에 부착
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
