-- AlterTable — 구독 자동 등록으로 만든 내역 표시 (같은 결제일은 다시 만들지 않는 기준)
ALTER TABLE `transaction` ADD COLUMN `subscription_id` INTEGER NULL COMMENT 'subscription.id FK' AFTER `target_id`;

-- AlterTable — 기존 구독도 켜진 상태로 시작한다
ALTER TABLE `subscription` ADD COLUMN `auto_ledger` BOOLEAN NOT NULL DEFAULT true COMMENT '가계부 자동 등록' AFTER `pay_method`;

-- CreateIndex
CREATE INDEX `transaction_subscription_id_idx` ON `transaction`(`subscription_id`);

-- AddForeignKey
ALTER TABLE `transaction` ADD CONSTRAINT `transaction_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
