-- CreateTable: 구독 (구독 관리 페이지) — 정기 결제 서비스
CREATE TABLE `subscription` (
    `id`                INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`           INTEGER       NOT NULL                COMMENT 'user.id FK',
    `name`              VARCHAR(100)  NOT NULL                COMMENT '서비스명',
    `category`          VARCHAR(50)   NOT NULL                COMMENT '카테고리코드',
    `amount`            DECIMAL(15,2) NOT NULL                COMMENT '결제금액(원)',
    `cycle`             ENUM('monthly','yearly','weekly') NOT NULL DEFAULT 'monthly' COMMENT '결제주기',
    `status`            ENUM('active','trial','paused')   NOT NULL DEFAULT 'active'  COMMENT '상태',
    `next_payment_date` DATE          NOT NULL                COMMENT '다음 결제일',
    `pay_method`        VARCHAR(50)   NOT NULL                COMMENT '결제수단',
    `last_used_at`      DATE          NULL                    COMMENT '마지막 사용일',
    `memo`              VARCHAR(300)  NULL                    COMMENT '메모',
    `deleted_at`        DATETIME(3)   NULL                    COMMENT '해지일(KST)',
    `created_at`        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`        DATETIME(3)   NOT NULL                COMMENT '수정일(KST)',

    INDEX `subscription_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='구독';

-- AddForeignKey
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- KST 타임스탬프 트리거 (created_at + updated_at)
CREATE TRIGGER `tr_subscription_bi` BEFORE INSERT ON `subscription` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_subscription_bu` BEFORE UPDATE ON `subscription` FOR EACH ROW SET NEW.updated_at = NOW();
