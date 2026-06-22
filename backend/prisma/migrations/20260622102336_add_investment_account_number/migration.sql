-- AlterTable
ALTER TABLE `investment_account` ADD COLUMN `account_number_enc` VARCHAR(255) NULL COMMENT '계좌번호(암호문, AES-256-GCM)',
    ALTER COLUMN `updated_at` DROP DEFAULT;
