-- DropIndex
DROP INDEX `transaction_recurring_parent_id_idx` ON `transaction`;

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
ALTER TABLE `investment` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `investment_account` ALTER COLUMN `updated_at` DROP DEFAULT;

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
ALTER TABLE `transaction` ADD COLUMN `recurring_schedule_id` INTEGER NULL COMMENT 'recurring_schedule.id FK (자동이체 설정으로 생성된 회차인 경우)',
    ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `user_settings` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `recurring_schedule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `kind` ENUM('transaction', 'investment') NOT NULL COMMENT '대상 종류',
    `rule` JSON NOT NULL COMMENT '반복 규칙',
    `start_date` DATE NOT NULL COMMENT '최초 실행 기준일',
    `last_period` VARCHAR(10) NULL COMMENT '마지막 처리 회차',
    `active` BOOLEAN NOT NULL DEFAULT true COMMENT '활성 여부',
    `tx_type` ENUM('income', 'expense', 'transfer') NULL COMMENT '거래유형(kind=transaction)',
    `title` VARCHAR(200) NULL COMMENT '내역명(kind=transaction)',
    `category` VARCHAR(50) NULL COMMENT '카테고리코드(kind=transaction)',
    `amount` DECIMAL(15, 2) NULL COMMENT '금액(kind=transaction)',
    `pay_method` VARCHAR(50) NULL COMMENT '결제수단(kind=transaction)',
    `memo` VARCHAR(300) NULL COMMENT '메모(kind=transaction)',
    `target_type` ENUM('saving', 'investment', 'asset') NULL COMMENT '이동 대상 종류(kind=transaction, transfer 전용)',
    `target_id` INTEGER NULL COMMENT '대상 테이블 id(kind=transaction)',
    `target_direction` ENUM('increase', 'decrease') NULL COMMENT '잔액 변화 방향(kind=transaction, asset 전용)',
    `investment_id` INTEGER NULL COMMENT 'investment.id FK(kind=investment)',
    `buy_amount` DECIMAL(15, 2) NULL COMMENT '회차당 매수금액(kind=investment)',
    `buy_quantity` DECIMAL(18, 6) NULL COMMENT '회차당 매수수량(kind=investment)',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL COMMENT '수정일(KST)',

    INDEX `recurring_schedule_user_id_idx`(`user_id`),
    INDEX `recurring_schedule_investment_id_idx`(`investment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='반복 자동 생성 설정(자동이체)';

-- CreateIndex
CREATE INDEX `transaction_recurring_schedule_id_idx` ON `transaction`(`recurring_schedule_id`);

-- AddForeignKey
ALTER TABLE `transaction` ADD CONSTRAINT `transaction_recurring_schedule_id_fkey` FOREIGN KEY (`recurring_schedule_id`) REFERENCES `recurring_schedule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_schedule` ADD CONSTRAINT `recurring_schedule_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_schedule` ADD CONSTRAINT `recurring_schedule_investment_id_fkey` FOREIGN KEY (`investment_id`) REFERENCES `investment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
