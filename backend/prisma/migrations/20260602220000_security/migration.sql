-- CreateTable: 보안 위험 요소 (보안 센터 - 위험 요소)
CREATE TABLE `security_risk` (
    `id`           INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`      INTEGER      NOT NULL                COMMENT 'user.id FK',
    `category`     ENUM('reuse','weak','no2fa','breach')          NOT NULL COMMENT '위험종류',
    `severity`     ENUM('critical','danger','warning','info')     NOT NULL COMMENT '심각도',
    `title`        VARCHAR(200) NOT NULL                COMMENT '제목',
    `description`  VARCHAR(300) NOT NULL                COMMENT '설명',
    `action_label` VARCHAR(20)  NOT NULL                COMMENT '처리버튼 라벨',
    `resolved`     BOOLEAN      NOT NULL DEFAULT false  COMMENT '해결여부',
    `resolved_at`  DATETIME(3)  NULL                    COMMENT '해결시각(KST)',
    `created_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`   DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `security_risk_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='보안 위험 요소';

-- CreateTable: 로그인 세션 (보안 센터 - 로그인 기기/세션)
CREATE TABLE `login_session` (
    `id`             INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`        INTEGER      NOT NULL                COMMENT 'user.id FK',
    `device`         VARCHAR(100) NOT NULL                COMMENT '기기/브라우저',
    `device_type`    ENUM('desktop','mobile','unknown') NOT NULL DEFAULT 'unknown' COMMENT '기기종류',
    `location`       VARCHAR(100) NOT NULL                COMMENT '위치/IP',
    `is_current`     BOOLEAN      NOT NULL DEFAULT false  COMMENT '현재기기 여부',
    `status`         ENUM('active','unverified') NOT NULL DEFAULT 'active' COMMENT '세션상태',
    `last_active_at` DATETIME(3)  NOT NULL                COMMENT '최근활동(KST)',
    `revoked_at`     DATETIME(3)  NULL                    COMMENT '로그아웃/차단 시각(KST)',
    `created_at`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    INDEX `login_session_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='로그인 세션';

-- AddForeignKey
ALTER TABLE `security_risk` ADD CONSTRAINT `security_risk_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `login_session` ADD CONSTRAINT `login_session_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- KST 타임스탬프 트리거
CREATE TRIGGER `tr_security_risk_bi` BEFORE INSERT ON `security_risk` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_security_risk_bu` BEFORE UPDATE ON `security_risk` FOR EACH ROW SET NEW.updated_at = NOW();
CREATE TRIGGER `tr_login_session_bi` BEFORE INSERT ON `login_session` FOR EACH ROW SET NEW.created_at = NOW();
