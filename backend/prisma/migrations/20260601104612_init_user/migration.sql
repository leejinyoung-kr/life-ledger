-- CreateTable
CREATE TABLE `user` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `google_id`  VARCHAR(100) NOT NULL                COMMENT 'Google 계정 고유 ID',
    `email`      VARCHAR(200) NOT NULL                COMMENT '이메일',
    `name`       VARCHAR(100) NOT NULL                COMMENT '이름',
    `picture`    VARCHAR(500) NULL                    COMMENT '프로필 사진 URL',
    `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    UNIQUE INDEX `user_google_id_key`(`google_id`),
    UNIQUE INDEX `user_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='회원';

-- KST 타임스탬프 트리거
CREATE TRIGGER `tr_user_bi` BEFORE INSERT ON `user` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_user_bu` BEFORE UPDATE ON `user` FOR EACH ROW SET NEW.updated_at = NOW();
