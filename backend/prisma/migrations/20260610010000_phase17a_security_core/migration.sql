-- Phase 17a 보안 코어 보강
-- 계정: 2FA 백업코드 + 비밀번호 변경시각 / 설정: 마스터 잠금 / 신규: 접근 감사 로그 · 보안점수 스냅샷

-- 1) credential — 2FA 백업코드 · 비번 변경시각
ALTER TABLE `credential`
    ADD COLUMN `backup_codes_enc`    TEXT        NULL COMMENT '2FA 백업코드 목록(JSON 배열 암호문)' AFTER `totp_enc`,
    ADD COLUMN `password_changed_at` DATETIME(3) NULL COMMENT '비밀번호 마지막 변경 시각(KST)' AFTER `backup_codes_enc`;

-- 2) user_settings — 마스터 잠금
ALTER TABLE `user_settings`
    ADD COLUMN `master_lock_enabled` BOOLEAN      NOT NULL DEFAULT false COMMENT '마스터 잠금 사용 여부'        AFTER `claude_model`,
    ADD COLUMN `master_lock_hash`    VARCHAR(200) NULL                   COMMENT '마스터 비번 해시(saltHex:hashHex)' AFTER `master_lock_enabled`,
    ADD COLUMN `master_lock_timeout` INTEGER      NOT NULL DEFAULT 5     COMMENT '자동잠금 시간(분), 0=수동'      AFTER `master_lock_hash`;

-- 3) access_log — 보관함 접근 감사 로그
CREATE TABLE `access_log` (
    `id`          INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`     INTEGER      NOT NULL                COMMENT 'user.id FK',
    `action`      ENUM('cred_reveal','cred_totp','cred_backup','identity_reveal','env_reveal') NOT NULL COMMENT '열람 동작',
    `target_type` VARCHAR(20)  NOT NULL                COMMENT '대상 종류(credential|identity|env)',
    `target_id`   INTEGER      NOT NULL                COMMENT '대상 레코드 id',
    `target_name` VARCHAR(200) NOT NULL                COMMENT '대상 표시명(열람 시점 스냅샷)',
    `ip`          VARCHAR(60)  NULL                    COMMENT '접속 IP',
    `user_agent`  VARCHAR(300) NULL                    COMMENT 'User-Agent',
    `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '열람일(KST)',

    INDEX `access_log_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='보관함 접근 감사 로그';

-- 4) security_score_snapshot — 보안점수 일별 스냅샷
CREATE TABLE `security_score_snapshot` (
    `id`         INTEGER     NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`    INTEGER     NOT NULL                COMMENT 'user.id FK',
    `date`       VARCHAR(10) NOT NULL                COMMENT '날짜(YYYY-MM-DD, KST)',
    `score`      INTEGER     NOT NULL                COMMENT '보안 점수 0~100',
    `reuse`      INTEGER     NOT NULL DEFAULT 0      COMMENT '재사용 비밀번호 건수',
    `weak`       INTEGER     NOT NULL DEFAULT 0      COMMENT '취약 비밀번호 건수',
    `no2fa`      INTEGER     NOT NULL DEFAULT 0      COMMENT '2FA 미설정 건수',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    UNIQUE INDEX `security_score_snapshot_user_id_date_key`(`user_id`, `date`),
    INDEX `security_score_snapshot_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='보안점수 일별 스냅샷';

-- 5) KST 타임스탬프 트리거 (created_at 단일)
CREATE TRIGGER `tr_access_log_bi`              BEFORE INSERT ON `access_log`              FOR EACH ROW SET NEW.created_at = NOW();
CREATE TRIGGER `tr_security_score_snapshot_bi` BEFORE INSERT ON `security_score_snapshot` FOR EACH ROW SET NEW.created_at = NOW();
