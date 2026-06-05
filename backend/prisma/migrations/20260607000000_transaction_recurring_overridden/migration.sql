-- 반복 회차 개별 수정 보존 플래그 — 범위(이후/전체) 수정에서 제외 대상 표시
ALTER TABLE `transaction`
  ADD COLUMN `recurring_overridden` BOOLEAN NOT NULL DEFAULT false COMMENT '사용자 개별 수정 회차(범위 수정 보존)';
