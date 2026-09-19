// jest setupFiles — 테스트 파일이 config/env 를 import 할 때 검증을 통과할 고정값(실제 값 아님).
// NODE_ENV=test 면 env.ts 가 로컬 .env 를 읽지 않으므로, 테스트 결과가 개발자 PC 의 .env 에 흔들리지 않는다
Object.assign(process.env, {
  NODE_ENV: 'test',
  FRONTEND_URL: 'http://localhost:3000',
  DATABASE_URL: 'mysql://test:test@localhost:3306/docnexus_test',
  JWT_SECRET: 'test-jwt-access-secret-0123456789abcdef',
  JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-0123456789abcdef',
  JWT_VAULT_SECRET: 'test-jwt-vault-secret-0123456789abcdef',
  // 키 ID 'test' — 스펙에서 암호문 머리(v2:test:)로 확인한다. CREDENTIAL_SECRET(v1 읽기 전용)은 두지 않는다
  CRYPTO_KEYS: 'test:test-crypto-key-0123456789abcdef0123',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:8000/api/v1/auth/google/callback',
  ALLOWED_EMAILS: 'tester@example.com',
  B2_KEY_ID: 'test-b2-key-id',
  B2_APPLICATION_KEY: 'test-b2-application-key',
  B2_BUCKET_NAME: 'test-bucket',
  B2_BUCKET_REGION: 'us-west-004',
  B2_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com',
});
