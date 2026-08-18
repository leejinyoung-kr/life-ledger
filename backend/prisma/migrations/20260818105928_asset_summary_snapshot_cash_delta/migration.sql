-- DropIndex
DROP INDEX `transaction_user_id_type_deleted_at_amount_idx` ON `transaction`;

-- AlterTable
ALTER TABLE `net_worth_snapshot` ADD COLUMN `cash_total` DECIMAL(15, 2) NULL;

-- CreateIndex
CREATE INDEX `transaction_user_id_type_deleted_at_date_amount_idx` ON `transaction`(`user_id`, `type`, `deleted_at`, `date`, `amount`);
