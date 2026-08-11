-- AlterTable
ALTER TABLE `subscription` ADD COLUMN `currency` ENUM('KRW', 'USD') NOT NULL DEFAULT 'KRW' COMMENT '통화' AFTER `amount`;
