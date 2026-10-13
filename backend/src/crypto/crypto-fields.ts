// 암호화 컬럼 목록 — 재암호화·점검(crypto-audit)이 이 목록만 순회한다.
// 암호문 컬럼을 추가하면 여기에도 추가한다(crypto-fields.spec.ts 가 schema.prisma 와 대조해 강제)
export const ENCRYPTED_COLUMNS = [
  {
    table: 'credential',
    column: 'password_enc',
    field: 'credential.password_enc',
  },
  { table: 'credential', column: 'totp_enc', field: 'credential.totp_enc' },
  {
    table: 'credential',
    column: 'backup_codes_enc',
    field: 'credential.backup_codes_enc',
  },
  {
    table: 'investment_account',
    column: 'account_number_enc',
    field: 'investmentAccount.account_number_enc',
  },
  // 암호화 도입 전에 평문으로 저장된 행이 있을 수 있다 — 재암호화가 암호문으로 바꾼다
  {
    table: 'user_settings',
    column: 'openai_api_key',
    field: 'userSettings.openai_api_key',
    legacyPlaintext: true,
  },
] as const;

export type EncryptedColumn = (typeof ENCRYPTED_COLUMNS)[number];
export type CipherField = EncryptedColumn['field'];

// 저장 암호문의 문맥(AAD) — 필드 + 소유 사용자.
// 다른 필드·다른 사용자 행으로 옮긴 암호문은 복호화되지 않는다(DB 를 고쳐 남의 비밀번호를 내 행에 복사해 열람하는 경로 차단)
export function cipherContext(field: CipherField, userId: number): string {
  return `${field}:${userId}`;
}

// 계정 JSON 백업의 문맥 — 사용자 id 대신 이메일에 묶는다.
// DB 를 다시 만들어 id 가 바뀌어도 같은 계정이면 복원되고, 다른 계정으로는 복원되지 않는다
export function exportContext(field: CipherField, email: string): string {
  return `export.${field}:${email.toLowerCase()}`;
}

// Prisma 모델명(camelCase) → 암호문 컬럼 목록.
// PrismaService 의 쓰기 가드(@leejinyoung-kr/core-security/prisma)가 이 목록으로 평문 저장을 막는다
export const ENCRYPTED_FIELD_MAP: Record<string, string[]> = ENCRYPTED_COLUMNS.reduce<
  Record<string, string[]>
>((map, { table, column }) => {
  const model = table.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
  (map[model] ??= []).push(column);
  return map;
}, {});
