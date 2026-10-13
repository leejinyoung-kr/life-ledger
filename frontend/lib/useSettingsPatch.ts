'use client';

/**
 * 설정 부분 저장 훅 — 변경 필드만 PUT /settings, 응답으로 캐시를 바로 갱신한다.
 * 설정 · 보안 화면이 같이 쓴다.
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import { qk } from '@/lib/queryKeys';
import type { Settings } from '@/lib/settings';

// 반환 함수: successMsg 가 null 이면 알림 없음, 생략하면 기본 문구
export function useSettingsPatch() {
  const qc = useQueryClient();
  return useCallback(async (partial: Record<string, unknown>, successMsg?: string | null) => {
    try {
      const data = await api.put<Settings>('/settings', partial);
      qc.setQueryData(qk.settings.detail(), data); // 캐시 즉시 갱신
      if (successMsg !== null) notify.success(successMsg ?? '저장됐습니다.');
      return data;
    } catch (e) {
      notify.error('저장에 실패했습니다.');
      throw e;
    }
  }, [qc]);
}
