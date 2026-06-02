-- CreateTable: 할일 (할일/목표 페이지 - 할 일)
CREATE TABLE `task` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`    INTEGER      NOT NULL                COMMENT 'user.id FK',
    `text`       VARCHAR(300) NOT NULL                COMMENT '할일 내용',
    `due_date`   DATE         NULL                    COMMENT '마감일',
    `priority`   ENUM('low','normal','high') NOT NULL DEFAULT 'normal' COMMENT '우선순위',
    `memo`       VARCHAR(300) NULL                    COMMENT '메모',
    `done`       BOOLEAN      NOT NULL DEFAULT false  COMMENT '완료여부',
    `done_at`    DATETIME(3)  NULL                    COMMENT '완료시각(KST)',
    `deleted_at` DATETIME(3)  NULL                    COMMENT '삭제일(KST)',
    `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `task_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='할일';

-- CreateTable: 목표 (할일/목표 페이지 - 목표)
CREATE TABLE `goal` (
    `id`          INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`     INTEGER       NOT NULL                COMMENT 'user.id FK',
    `name`        VARCHAR(200)  NOT NULL                COMMENT '목표명',
    `unit`        VARCHAR(10)   NOT NULL                COMMENT '단위(won/percent)',
    `current_val` DECIMAL(15,2) NOT NULL                COMMENT '현재값',
    `target_val`  DECIMAL(15,2) NOT NULL                COMMENT '목표값',
    `pct`         INTEGER       NOT NULL                COMMENT '진행률(%)',
    `tone`        ENUM('green','warning','danger') NOT NULL DEFAULT 'green' COMMENT '진행바색',
    `deleted_at`  DATETIME(3)   NULL                    COMMENT '삭제일(KST)',
    `created_at`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`  DATETIME(3)   NOT NULL                COMMENT '수정일(KST)',

    INDEX `goal_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='목표';

-- AddForeignKey
ALTER TABLE `task` ADD CONSTRAINT `task_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `goal` ADD CONSTRAINT `goal_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- KST 타임스탬프 트리거
CREATE TRIGGER `tr_task_bi` BEFORE INSERT ON `task` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_task_bu` BEFORE UPDATE ON `task` FOR EACH ROW SET NEW.updated_at = NOW();
CREATE TRIGGER `tr_goal_bi` BEFORE INSERT ON `goal` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_goal_bu` BEFORE UPDATE ON `goal` FOR EACH ROW SET NEW.updated_at = NOW();
