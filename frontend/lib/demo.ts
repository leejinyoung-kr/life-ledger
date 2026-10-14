// 데모 인스턴스 빌드인지 — 빌드 때 NEXT_PUBLIC_DEMO_MODE=true 로 굽는다(운영 빌드에서는 데모 화면 요소가 아예 없다)
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// 데모 마스터 잠금 비밀번호 — 백엔드 common/demo.ts 와 같은 값. 비밀이 아니라 방문자에게 보여 주는 값이다
export const DEMO_VAULT_PASSWORD = 'demo1234';
