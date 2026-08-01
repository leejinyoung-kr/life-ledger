-- DropForeignKey
ALTER TABLE `goal` DROP FOREIGN KEY `goal_user_id_fkey`;

-- DropTable
DROP TABLE `goal`;

-- CreateTable
CREATE TABLE `calendar_event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `date` DATE NOT NULL COMMENT '일정 날짜',
    `type` ENUM('pay', 'due', 'exp', 'task') NOT NULL COMMENT '일정유형',
    `title` VARCHAR(200) NOT NULL COMMENT '제목',
    `memo` VARCHAR(300) NULL COMMENT '메모',
    `recur_freq` ENUM('none', 'weekly', 'monthly', 'yearly') NOT NULL DEFAULT 'none' COMMENT '반복 주기',
    `recur_until` DATE NULL COMMENT '반복 종료일 (null = 무기한)',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL COMMENT '수정일(KST)',

    INDEX `calendar_event_user_id_date_idx`(`user_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='캘린더 일정';

-- AddForeignKey
ALTER TABLE `calendar_event` ADD CONSTRAINT `calendar_event_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
