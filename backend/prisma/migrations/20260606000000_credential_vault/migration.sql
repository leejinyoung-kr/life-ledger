-- CreateTable: 신원 지갑 — 문서 번호는 AES-256-GCM 암호화 저장
CREATE TABLE `identity_card` (
    `id`          INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`     INTEGER      NOT NULL                COMMENT 'user.id FK',
    `type`        ENUM('passport','idcard','license','cert','etc') NOT NULL COMMENT '종류',
    `name`        VARCHAR(100) NOT NULL                COMMENT '명칭',
    `number_enc`  TEXT         NOT NULL                COMMENT '문서 번호(암호문)',
    `issue_date`  DATE         NULL                    COMMENT '발급일',
    `expire_date` DATE         NULL                    COMMENT '만료일',
    `memo`        VARCHAR(300) NULL                    COMMENT '메모',
    `deleted_at`  DATETIME(3)  NULL                    COMMENT '삭제일(KST)',
    `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`  DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `identity_card_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='신원 지갑';

-- CreateTable: 계정 보관함 — 비밀번호·TOTP 는 AES-256-GCM 암호화 저장
CREATE TABLE `credential` (
    `id`           INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`      INTEGER      NOT NULL                COMMENT 'user.id FK',
    `name`         VARCHAR(100) NOT NULL                COMMENT '서비스명',
    `emoji`        VARCHAR(10)  NULL                    COMMENT '아이콘 이모지',
    `url`          VARCHAR(300) NULL                    COMMENT 'URL',
    `category`     VARCHAR(50)  NOT NULL                COMMENT '카테고리',
    `username`     VARCHAR(200) NOT NULL                COMMENT '아이디',
    `password_enc` TEXT         NOT NULL                COMMENT '비밀번호(암호문)',
    `totp_enc`     TEXT         NULL                    COMMENT '2FA TOTP 시크릿(암호문)',
    `memo`         VARCHAR(300) NULL                    COMMENT '메모',
    `deleted_at`   DATETIME(3)  NULL                    COMMENT '삭제일(KST)',
    `created_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`   DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `credential_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='계정 보관함';

-- CreateTable: ENV 프로젝트 — 환경변수 묶음 단위
CREATE TABLE `env_project` (
    `id`          INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`     INTEGER      NOT NULL                COMMENT 'user.id FK',
    `emoji`       VARCHAR(10)  NULL                    COMMENT '아이콘 이모지',
    `name`        VARCHAR(100) NOT NULL                COMMENT '프로젝트명',
    `description` VARCHAR(300) NULL                    COMMENT '설명',
    `deleted_at`  DATETIME(3)  NULL                    COMMENT '삭제일(KST)',
    `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`  DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `env_project_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='ENV 프로젝트';

-- CreateTable: ENV 변수 — 값(value)은 AES-256-GCM 암호화 저장
CREATE TABLE `env_var` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`    INTEGER      NOT NULL                COMMENT 'user.id FK',
    `project_id` INTEGER      NOT NULL                COMMENT 'env_project.id FK',
    `env`        ENUM('dev','staging','prod') NOT NULL COMMENT '환경',
    `group`      VARCHAR(50)  NULL                    COMMENT '그룹',
    `key`        VARCHAR(150) NOT NULL                COMMENT 'KEY',
    `value_enc`  TEXT         NOT NULL                COMMENT '값(암호문)',
    `memo`       VARCHAR(300) NULL                    COMMENT '메모',
    `deleted_at` DATETIME(3)  NULL                    COMMENT '삭제일(KST)',
    `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `env_var_user_id_idx`(`user_id`),
    INDEX `env_var_project_id_env_idx`(`project_id`, `env`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='ENV 변수';

-- AddForeignKey
ALTER TABLE `identity_card` ADD CONSTRAINT `identity_card_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `credential` ADD CONSTRAINT `credential_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `env_project` ADD CONSTRAINT `env_project_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `env_var` ADD CONSTRAINT `env_var_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `env_var` ADD CONSTRAINT `env_var_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `env_project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- KST 타임스탬프 트리거 (created_at + updated_at)
CREATE TRIGGER `tr_identity_card_bi` BEFORE INSERT ON `identity_card` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_identity_card_bu` BEFORE UPDATE ON `identity_card` FOR EACH ROW SET NEW.updated_at = NOW();
CREATE TRIGGER `tr_credential_bi` BEFORE INSERT ON `credential` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_credential_bu` BEFORE UPDATE ON `credential` FOR EACH ROW SET NEW.updated_at = NOW();
CREATE TRIGGER `tr_env_project_bi` BEFORE INSERT ON `env_project` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_env_project_bu` BEFORE UPDATE ON `env_project` FOR EACH ROW SET NEW.updated_at = NOW();
CREATE TRIGGER `tr_env_var_bi` BEFORE INSERT ON `env_var` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_env_var_bu` BEFORE UPDATE ON `env_var` FOR EACH ROW SET NEW.updated_at = NOW();
