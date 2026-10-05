-- AlterTable — 기존 행은 지금 결제일의 일(day)로 채운 뒤 기본값을 뗀다 (schema.prisma 에 기본값 없음)
ALTER TABLE `subscription` ADD COLUMN `billing_day` TINYINT NOT NULL DEFAULT 1 COMMENT '원래 결제일(1-31)' AFTER `next_payment_date`;
UPDATE `subscription` SET `billing_day` = DAY(`next_payment_date`);
ALTER TABLE `subscription` ALTER COLUMN `billing_day` DROP DEFAULT;

-- CreateTable
CREATE TABLE `transaction_favorite` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `type` ENUM('income', 'expense', 'transfer') NOT NULL COMMENT '유형',
    `title` VARCHAR(200) NOT NULL COMMENT '내역명',
    `category` VARCHAR(50) NOT NULL COMMENT '카테고리 코드',
    `amount` DECIMAL(15, 2) NOT NULL COMMENT '기본 금액',
    `pay_method` VARCHAR(50) NOT NULL COMMENT '결제수단 코드',
    `memo` VARCHAR(300) NULL COMMENT '메모',
    `sort_order` INTEGER NOT NULL DEFAULT 0 COMMENT '표시 순서',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL COMMENT '수정일(KST)',

    INDEX `transaction_favorite_user_id_sort_order_idx`(`user_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='거래 즐겨찾기';

-- AddForeignKey
ALTER TABLE `transaction_favorite` ADD CONSTRAINT `transaction_favorite_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
