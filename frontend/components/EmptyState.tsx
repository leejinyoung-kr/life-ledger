'use client';

// 목록/카드가 비었을 때 중앙정렬 안내 텍스트.
// 테이블 빈 행(<td colSpan>)에는 쓰지 않는다 (구조가 달라 td-center td-muted 직접 사용).
// 패딩·글자크기가 페이지마다 달라 className 으로 덮어쓴다 (기본 py-7).
export default function EmptyState({
  message,
  className = 'text-center text-muted py-7 text-[0.875rem]',
}: {
  message: string;
  className?: string;
}) {
  return <div className={className}>{message}</div>;
}
