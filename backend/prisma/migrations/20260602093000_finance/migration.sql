-- CreateTable: 수입/지출 내역 (가계부 - 수입/지출 탭)
CREATE TABLE `transaction` (
    `id`             INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`        INTEGER       NOT NULL                COMMENT 'user.id FK',
    `type`           ENUM('income','expense','transfer') NOT NULL COMMENT '거래유형',
    `date`           DATE          NOT NULL                COMMENT '거래일',
    `title`          VARCHAR(200)  NOT NULL                COMMENT '내역명',
    `category`       VARCHAR(50)   NOT NULL                COMMENT '카테고리코드',
    `amount`         DECIMAL(15,2) NOT NULL                COMMENT '금액(원)',
    `pay_method`     VARCHAR(50)   NOT NULL                COMMENT '결제수단',
    `memo`           VARCHAR(300)  NULL                    COMMENT '메모',
    `is_recurring`   BOOLEAN       NOT NULL DEFAULT false  COMMENT '반복거래 여부',
    `recurring_rule` JSON          NULL                    COMMENT '반복규칙',
    `deleted_at`     DATETIME(3)   NULL                    COMMENT '삭제일(KST)',
    `created_at`     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`     DATETIME(3)   NOT NULL                COMMENT '수정일(KST)',

    INDEX `transaction_user_id_date_idx`(`user_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='수입/지출 내역';

-- CreateTable: 예적금 (가계부 - 예적금 탭)
CREATE TABLE `saving` (
    `id`             INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`        INTEGER       NOT NULL                COMMENT 'user.id FK',
    `bank`           VARCHAR(100)  NOT NULL                COMMENT '은행/기관',
    `name`           VARCHAR(100)  NOT NULL                COMMENT '상품명',
    `type`           ENUM('savings','deposit','subscription','etc') NOT NULL COMMENT '예적금유형',
    `interest_rate`  DECIMAL(5,2)  NOT NULL                COMMENT '금리(%)',
    `monthly_amount` DECIMAL(15,2) NOT NULL                COMMENT '월 납입액(원)',
    `start_date`     DATE          NOT NULL                COMMENT '가입일',
    `maturity_date`  DATE          NULL                    COMMENT '만기일',
    `balance`        DECIMAL(15,2) NOT NULL                COMMENT '현재 잔액(원)',
    `memo`           VARCHAR(300)  NULL                    COMMENT '메모',
    `deleted_at`     DATETIME(3)   NULL                    COMMENT '삭제일(KST)',
    `created_at`     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`     DATETIME(3)   NOT NULL                COMMENT '수정일(KST)',

    INDEX `saving_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='예적금';

-- CreateTable: 투자 (가계부 - 투자 탭)
CREATE TABLE `investment` (
    `id`            INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`       INTEGER       NOT NULL                COMMENT 'user.id FK',
    `name`          VARCHAR(100)  NOT NULL                COMMENT '종목명',
    `type`          ENUM('domestic_stock','foreign_stock','foreign_etf','domestic_etf','crypto','etc') NOT NULL COMMENT '투자유형',
    `principal`     DECIMAL(15,2) NOT NULL                COMMENT '투자원금(원)',
    `current_value` DECIMAL(15,2) NOT NULL                COMMENT '현재 평가금액(원)',
    `purchase_date` DATE          NOT NULL                COMMENT '최초 매수일',
    `memo`          VARCHAR(300)  NULL                    COMMENT '메모',
    `deleted_at`    DATETIME(3)   NULL                    COMMENT '삭제일(KST)',
    `created_at`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`    DATETIME(3)   NOT NULL                COMMENT '수정일(KST)',

    INDEX `investment_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='투자';

-- AddForeignKey
ALTER TABLE `transaction` ADD CONSTRAINT `transaction_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `saving` ADD CONSTRAINT `saving_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `investment` ADD CONSTRAINT `investment_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- KST 타임스탬프 트리거 (created_at + updated_at)
CREATE TRIGGER `tr_transaction_bi` BEFORE INSERT ON `transaction` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_transaction_bu` BEFORE UPDATE ON `transaction` FOR EACH ROW SET NEW.updated_at = NOW();
CREATE TRIGGER `tr_saving_bi` BEFORE INSERT ON `saving` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_saving_bu` BEFORE UPDATE ON `saving` FOR EACH ROW SET NEW.updated_at = NOW();
CREATE TRIGGER `tr_investment_bi` BEFORE INSERT ON `investment` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_investment_bu` BEFORE UPDATE ON `investment` FOR EACH ROW SET NEW.updated_at = NOW();
