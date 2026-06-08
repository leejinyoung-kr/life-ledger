/**
 * 신원 지갑 공통 타입 · 라벨 · 날짜/D-day 계산.
 * 백엔드 응답 DTO(/identities)와 1:1 대응한다. 번호 원문은 reveal API 로만 받는다.
 */

export type IdType = 'passport' | 'idcard' | 'license' | 'cert' | 'etc';

export interface IdCard {
  id: number;
  type: IdType;
  name: string;
  numberMasked: string;
  issueDate: string | null; // YYYY-MM-DD
  expireDate: string | null;
  memo: string | null;
  fileId: number | null; // 사본 이미지 (파일 보관함 file.id)
  updatedAt: string; // ISO
}

// 카드 상단 라벨 (영문 · 한글)
export const ID_TYPE_LABEL: Record<IdType, string> = {
  passport: 'PASSPORT · 여권',
  idcard: 'ID CARD · 주민등록증',
  license: 'DRIVER LICENSE · 운전면허',
  cert: 'CERTIFICATE · 자격증',
  etc: 'DOCUMENT · 기타',
};

// 추가/수정 모달 종류 선택 옵션
export const ID_TYPE_OPTIONS: { value: IdType; label: string }[] = [
  { value: 'passport', label: '여권' },
  { value: 'idcard', label: '주민등록증' },
  { value: 'license', label: '운전면허' },
  { value: 'cert', label: '자격증' },
  { value: 'etc', label: '기타' },
];

// 카드 유형별 그라데이션 배경 (Tailwind arbitrary)
export const ID_VARIANT_BG: Record<IdType, string> = {
  passport: '[background:linear-gradient(135deg,#1e3a5f,#2d5986)]',
  idcard: '[background:linear-gradient(135deg,#0f7a5a,#00a86d)]',
  license: '[background:linear-gradient(135deg,#7a3a1e,#b8682d)]',
  cert: '[background:linear-gradient(135deg,#3a2d6b,#5b4b9e)]',
  etc: '[background:linear-gradient(135deg,#3a3a3a,#5b5b5b)]',
};

// 'YYYY-MM-DD' → 'YYYY.MM.DD' (없으면 '—')
export function fmtDate(s: string | null): string {
  return s ? s.replace(/-/g, '.') : '—';
}

// 만료일까지 D-day 라벨 + 임박(60일 이내) 경고 여부
export function ddayOf(expire: string | null): { text: string; warn: boolean } {
  if (!expire) return { text: 'D-—', warn: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(`${expire}T00:00:00`);
  const days = Math.round((exp.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { text: '만료됨', warn: true };
  if (days === 0) return { text: 'D-DAY', warn: true };
  return { text: `D-${days}`, warn: days <= 60 };
}
