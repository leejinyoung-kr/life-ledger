-- AlterTable
ALTER TABLE `investment`
    MODIFY COLUMN `recurring_buy_amount` DECIMAL(15, 2) NULL COMMENT '회차당 매수금액(국내 원·해외 달러)',
    ADD COLUMN `recurring_buy_quantity` DECIMAL(18, 6) NULL COMMENT '회차당 매수수량(주)';
