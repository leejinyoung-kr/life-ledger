// 서버 페이지네이션 공통 유틸.
// 목록 응답은 page 쿼리 유무로 형태가 갈린다:
//  - page 있음 → Paginated<T> ({ items, total, page, limit })
//  - page 없음 → T[] (기존 소비자 — 대시보드/순자산 집계 등 — 호환 유지)

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// page/limit 문자열을 prisma skip/take 로 변환. page 미지정이면 null(=전체 조회).
// limit 은 1~100 으로 클램프(과도한 페이로드 방지), 기본 20.
export function parsePage(
  page?: string,
  limit?: string,
): { skip: number; take: number; page: number; limit: number } | null {
  if (page === undefined) return null;
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  const l = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 20));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}
