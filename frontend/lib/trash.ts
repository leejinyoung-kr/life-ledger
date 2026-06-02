/**
 * 휴지통 공통 타입.
 * 백엔드 응답 DTO(GET /trash)와 1:1 대응한다. 여러 도메인의 삭제 항목을 통합한 형태.
 */

export interface TrashItem {
  kind: string; // transaction|saving|... (복구/삭제 시 종류 식별)
  type: string; // 표시 라벨 (가계부/메모 등)
  chip: string; // 이모지+라벨 칩
  id: number;
  name: string;
  deletedAt: string; // ISO
  daysLeft: number; // 남은 보관일 (30일 - 경과)
}

// ISO → YYYY.MM.DD
export function trashDate(iso: string): string {
  return iso.slice(0, 10).replaceAll('-', '.');
}
