-- 예산 기능 제거 — 월별 예산(이월) 테이블 + 기본 예산/예산초과 알림 설정 컬럼 삭제

-- 1) 월별 예산 오버라이드 테이블 제거 (FK 포함 DROP)
DROP TABLE IF EXISTS `monthly_budget`;

-- 2) 사용자 설정에서 기본 예산·예산초과 알림 컬럼 제거
ALTER TABLE `user_settings`
    DROP COLUMN `budgets`,
    DROP COLUMN `notif_budget`;
