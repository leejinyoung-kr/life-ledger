-- CreateEnum (MySQL: represented as ENUM column type)
-- AlterTable
ALTER TABLE `calendar_event` ADD COLUMN `recur_freq` ENUM('none', 'weekly', 'monthly', 'yearly') NOT NULL DEFAULT 'none' COMMENT '반복 주기',
    ADD COLUMN `recur_until` DATE NULL COMMENT '반복 종료일 (null = 무기한)';
