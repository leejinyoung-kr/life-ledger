-- DropIndex
DROP INDEX `transaction_user_id_type_deleted_at_idx` ON `transaction`;

-- CreateIndex
CREATE INDEX `transaction_user_id_type_deleted_at_amount_idx` ON `transaction`(`user_id`, `type`, `deleted_at`, `amount`);
