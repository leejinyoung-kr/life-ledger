-- CreateTable: 캘린더 일정 (캘린더 페이지)
CREATE TABLE `calendar_event` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`    INTEGER      NOT NULL                COMMENT 'user.id FK',
    `date`       DATE         NOT NULL                COMMENT '일정 날짜',
    `type`       ENUM('pay','due','exp','task') NOT NULL COMMENT '일정유형',
    `title`      VARCHAR(200) NOT NULL                COMMENT '제목',
    `memo`       VARCHAR(300) NULL                    COMMENT '메모',
    `deleted_at` DATETIME(3)  NULL                    COMMENT '삭제일(KST)',
    `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `calendar_event_user_id_date_idx`(`user_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='캘린더 일정';

-- AddForeignKey
ALTER TABLE `calendar_event` ADD CONSTRAINT `calendar_event_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- KST 타임스탬프 트리거 (created_at + updated_at)
CREATE TRIGGER `tr_calendar_event_bi` BEFORE INSERT ON `calendar_event` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_calendar_event_bu` BEFORE UPDATE ON `calendar_event` FOR EACH ROW SET NEW.updated_at = NOW();
