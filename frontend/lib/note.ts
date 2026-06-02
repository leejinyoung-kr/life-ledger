/**
 * 메모 공통 타입 · 날짜 포맷.
 * 백엔드 응답 DTO(/notes)와 1:1 대응한다.
 */

export interface Note {
  id: number;
  title: string;
  body: string;
  tag: string | null;
  updatedAt: string; // ISO
}

// ISO → 'YYYY년 M월 D일'
export function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
