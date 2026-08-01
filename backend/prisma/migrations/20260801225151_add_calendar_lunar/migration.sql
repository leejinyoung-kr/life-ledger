-- AlterTable
ALTER TABLE `calendar_event` ADD COLUMN `is_lunar` BOOLEAN NOT NULL DEFAULT false COMMENT '음력 날짜 여부 (true면 lunar_month/lunar_day가 기준)',
    ADD COLUMN `lunar_day` INTEGER NULL COMMENT '음력 일',
    ADD COLUMN `lunar_leap` BOOLEAN NOT NULL DEFAULT false COMMENT '윤달 여부',
    ADD COLUMN `lunar_month` INTEGER NULL COMMENT '음력 월 (is_lunar=true일 때만 사용)';
