'use client';

// 목록/카드가 비었을 때 중앙정렬 안내 텍스트.
// 테이블 빈 행에는 TableEmptyRow 를 쓴다. size 로 여백을 고르고 className 은 바깥 간격(margin)용이다.
const SIZE = {
  sm: 'py-5 text-[0.84rem]',
  md: 'py-7 text-[0.875rem]',
  lg: 'py-12 text-sm',
} as const;

export default function EmptyState({
  message,
  size = 'md',
  className = '',
}: {
  message: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return <div className={`text-center text-muted ${SIZE[size]} ${className}`.trim()}>{message}</div>;
}
