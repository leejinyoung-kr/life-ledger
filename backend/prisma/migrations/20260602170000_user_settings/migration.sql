-- CreateTable: 사용자 설정 (설정 페이지) — 1:1
CREATE TABLE `user_settings` (
    `id`             INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`        INTEGER      NOT NULL                COMMENT 'user.id FK',
    `display_name`   VARCHAR(100) NULL                    COMMENT '표시 이름',
    `notif_budget`   BOOLEAN      NOT NULL DEFAULT true   COMMENT '예산 초과 알림',
    `notif_monthly`  BOOLEAN      NOT NULL DEFAULT true   COMMENT '월간 리포트 자동생성 알림',
    `notif_upload`   BOOLEAN      NOT NULL DEFAULT false  COMMENT '파일 업로드 완료 알림',
    `session_expiry` VARCHAR(10)  NOT NULL DEFAULT '7d'   COMMENT '세션 자동만료',
    `pw_auto_hide`   VARCHAR(10)  NOT NULL DEFAULT '10s'  COMMENT '비밀번호 자동숨김',
    `claude_api_key` VARCHAR(200) NULL                    COMMENT 'Claude API 키',
    `claude_model`   VARCHAR(50)  NOT NULL DEFAULT 'claude-sonnet-4-6' COMMENT 'Claude 모델',
    `budgets`        JSON         NOT NULL                COMMENT '카테고리별 월 예산',
    `categories`     JSON         NOT NULL                COMMENT '카테고리 목록',
    `widgets`        JSON         NOT NULL                COMMENT '대시보드 위젯 표시/순서',
    `created_at`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`     DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    UNIQUE INDEX `user_settings_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='사용자 설정';

-- AddForeignKey
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- KST 타임스탬프 트리거 (created_at + updated_at)
CREATE TRIGGER `tr_user_settings_bi` BEFORE INSERT ON `user_settings` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_user_settings_bu` BEFORE UPDATE ON `user_settings` FOR EACH ROW SET NEW.updated_at = NOW();
