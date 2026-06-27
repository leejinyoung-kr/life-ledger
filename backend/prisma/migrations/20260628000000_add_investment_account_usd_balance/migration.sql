-- AlterTable
ALTER TABLE `investment_account` ADD COLUMN `cash_balance_usd` DECIMAL(15, 2) NOT NULL DEFAULT 0 COMMENT '달러 예수금' AFTER `cash_balance`;
