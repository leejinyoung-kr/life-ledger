-- AlterTable
ALTER TABLE `investment` DROP COLUMN `recurring_buy_amount`,
    DROP COLUMN `recurring_buy_enabled`,
    DROP COLUMN `recurring_buy_last_period`,
    DROP COLUMN `recurring_buy_quantity`,
    DROP COLUMN `recurring_buy_rule`;

-- AlterTable
ALTER TABLE `transaction` DROP COLUMN `is_recurring`,
    DROP COLUMN `recurring_overridden`,
    DROP COLUMN `recurring_parent_id`,
    DROP COLUMN `recurring_rule`;
