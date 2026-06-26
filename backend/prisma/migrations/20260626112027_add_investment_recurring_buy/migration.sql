-- AlterTable
ALTER TABLE `investment` ADD COLUMN `recurring_buy_amount` DECIMAL(15, 2) NULL COMMENT '회차당 매수금액',
    ADD COLUMN `recurring_buy_enabled` BOOLEAN NOT NULL DEFAULT false COMMENT '반복매수 사용 여부',
    ADD COLUMN `recurring_buy_last_period` VARCHAR(10) NULL COMMENT '마지막 처리 회차',
    ADD COLUMN `recurring_buy_rule` JSON NULL COMMENT '반복 규칙';
