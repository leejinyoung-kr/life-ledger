-- CreateTable: 알림 (알림 페이지)
CREATE TABLE `notification` (
    `id`          INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`     INTEGER      NOT NULL                COMMENT 'user.id FK',
    `group`       ENUM('ledger','system')          NOT NULL COMMENT '알림그룹',
    `tone`        ENUM('warning','success','info') NOT NULL COMMENT '톤',
    `title`       VARCHAR(200) NOT NULL                COMMENT '제목',
    `description` VARCHAR(500) NOT NULL                COMMENT '내용',
    `source`      VARCHAR(50)  NOT NULL                COMMENT '발생처 라벨',
    `read_at`     DATETIME(3)  NULL                    COMMENT '읽은시각(KST)',
    `occurred_at` DATETIME(3)  NOT NULL                COMMENT '발생시각(화면표시용)',
    `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    INDEX `notification_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='알림';

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- KST 타임스탬프 트리거 (created_at)
CREATE TRIGGER `tr_notification_bi` BEFORE INSERT ON `notification` FOR EACH ROW SET NEW.created_at = NOW();
