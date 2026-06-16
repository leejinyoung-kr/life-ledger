'use client';

// 조회 실패 시 표시하는 작은 인라인 배너 (⚠️ + 메시지).
// 재시도 버튼이 달린 큰 블록이 필요하면 QueryError 를 쓴다.
// message 가 비면 아무것도 렌더하지 않으므로 호출부에서 조건 분기 없이 그냥 둘 수 있다.
// 간격은 페이지마다 달라 className 으로 덮어쓴다 (기본 mt-3 mb-3).
export default function ErrorBanner({
  message,
  className = 'mt-3 mb-3',
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return <p className={`text-[0.78rem] text-danger ${className}`}>⚠️ {message}</p>;
}
