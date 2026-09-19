// 배포 전 점검 — 새 이미지로 환경변수 검증만 하고 끝낸다(node dist/config/check-env).
// 실패하면 env.ts 가 틀린 키 목록과 함께 던져 exit 1 → 배포 워크플로가 기존 컨테이너를 교체하기 전에 멈춘다.
// 값은 배포 로그에 남기지 않는다(가린 유효 설정은 부팅 로그에만)
import { env } from './env';

console.log(`환경변수 검증 통과 (키 ${Object.keys(env).length}개)`);
