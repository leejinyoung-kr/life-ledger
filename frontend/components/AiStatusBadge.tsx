'use client';

/**
 * 헤더 좌측 AI 연동 상태 배지.
 * settings.openaiApiKeySet 으로 연동/미연동을 한눈에 표시하고, 클릭 시 설정 API 탭으로 이동.
 * 모델 가용성(verify) 결과는 서버에 영속되지 않으므로 2-state(연동/미연동)만 표시한다.
 */
import { useApiQuery } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import type { Settings } from '@/lib/settings';

export default function AiStatusBadge() {
  // TopBar 와 동일 키 → settings 쿼리 캐시 공유 (추가 요청 없음)
  const s = useApiQuery<Settings>(qk.settings.detail(), '/settings').data;
  // 설정 로드 전엔 표시하지 않음 (깜빡임 방지)
  if (!s) return null;

  const linked = s.openaiApiKeySet;

  return (
    <a
      href="/settings?tab=api"
      className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[0.72rem] font-medium border transition-colors shrink-0 ${
        linked
          ? 'border-[rgba(0,192,127,0.3)] bg-accent-dim text-accent hover:bg-accent-dim/70'
          : 'border-border bg-surface text-muted hover:text-secondary hover:border-border'
      }`}
      title={linked ? 'AI 연동됨 · 클릭하여 설정' : 'AI 미연동 · 클릭하여 키 등록'}
      aria-label={linked ? 'AI 연동됨' : 'AI 미연동'}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${linked ? 'bg-accent' : 'bg-muted'}`}
        aria-hidden
      />
      AI
    </a>
  );
}
