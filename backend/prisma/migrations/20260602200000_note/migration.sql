-- CreateTable: 메모 (메모 페이지) — 마크다운 본문
CREATE TABLE `note` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`    INTEGER      NOT NULL                COMMENT 'user.id FK',
    `title`      VARCHAR(200) NOT NULL                COMMENT '제목',
    `body`       TEXT         NOT NULL                COMMENT '본문(마크다운)',
    `tag`        VARCHAR(50)  NULL                    COMMENT '태그',
    `deleted_at` DATETIME(3)  NULL                    COMMENT '삭제일(KST)',
    `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `note_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='메모';

-- AddForeignKey
ALTER TABLE `note` ADD CONSTRAINT `note_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- KST 타임스탬프 트리거 (created_at + updated_at)
CREATE TRIGGER `tr_note_bi` BEFORE INSERT ON `note` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_note_bu` BEFORE UPDATE ON `note` FOR EACH ROW SET NEW.updated_at = NOW();
