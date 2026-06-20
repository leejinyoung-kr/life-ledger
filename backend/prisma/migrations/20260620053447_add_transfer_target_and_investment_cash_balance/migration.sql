-- AlterTable
ALTER TABLE `asset` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `calendar_event` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `category` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `credential` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `env_project` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `env_var` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `goal` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `identity_card` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `investment` ADD COLUMN `cash_balance` DECIMAL(15, 2) NOT NULL DEFAULT 0 COMMENT '예수금(미투자 대기 현금)',
    ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `note` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `saving` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `security_risk` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `storage_file` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `storage_folder` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `subscription` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `task` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `transaction` ADD COLUMN `target_id` INTEGER NULL COMMENT '대상 테이블 id (target_type 기준)',
    ADD COLUMN `target_type` ENUM('saving', 'investment', 'asset') NULL COMMENT '이동 대상 종류(transfer 전용)',
    ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `user_settings` ALTER COLUMN `updated_at` DROP DEFAULT;
