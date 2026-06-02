-- CreateTable: 자산/부채 (자산 종합 페이지)
CREATE TABLE `asset` (
    `id`            INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`       INTEGER       NOT NULL                COMMENT 'user.id FK',
    `type`          ENUM('cash','savings','investment','realestate','debt','etc') NOT NULL COMMENT '자산유형',
    `name`          VARCHAR(100)  NOT NULL                COMMENT '자산명',
    `amount`        DECIMAL(15,2) NOT NULL                COMMENT '금액(원)',
    `interest_rate` DECIMAL(5,2)  NULL                    COMMENT '금리(%)',
    `memo`          VARCHAR(300)  NULL                    COMMENT '메모',
    `deleted_at`    DATETIME(3)   NULL                    COMMENT '삭제일(KST)',
    `created_at`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`    DATETIME(3)   NOT NULL                COMMENT '수정일(KST)',

    INDEX `asset_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='자산/부채';

-- CreateTable: 순자산 월별 스냅샷 (자산 종합 - 추이 차트용)
CREATE TABLE `net_worth_snapshot` (
    `id`           INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`      INTEGER       NOT NULL                COMMENT 'user.id FK',
    `month`        VARCHAR(7)    NOT NULL                COMMENT '기준월(YYYY-MM)',
    `total_assets` DECIMAL(15,2) NOT NULL                COMMENT '총자산(원)',
    `total_debt`   DECIMAL(15,2) NOT NULL                COMMENT '총부채(원)',
    `created_at`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    UNIQUE INDEX `net_worth_snapshot_user_id_month_key`(`user_id`, `month`),
    INDEX `net_worth_snapshot_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='순자산 월별 스냅샷';

-- AddForeignKey
ALTER TABLE `asset` ADD CONSTRAINT `asset_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `net_worth_snapshot` ADD CONSTRAINT `net_worth_snapshot_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- KST 타임스탬프 트리거
CREATE TRIGGER `tr_asset_bi` BEFORE INSERT ON `asset` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_asset_bu` BEFORE UPDATE ON `asset` FOR EACH ROW SET NEW.updated_at = NOW();
CREATE TRIGGER `tr_net_worth_snapshot_bi` BEFORE INSERT ON `net_worth_snapshot` FOR EACH ROW SET NEW.created_at = NOW();
