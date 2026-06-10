-- AI 사용량 로그 (OpenAI 호출별 토큰·비용 기록 — 잔액 조회 API 부재 대체)
CREATE TABLE `ai_usage_log` (
    `id`                INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`           INTEGER       NOT NULL                COMMENT 'user.id FK',
    `model`             VARCHAR(50)   NOT NULL                COMMENT '호출에 사용한 OpenAI 모델',
    `source`            VARCHAR(20)   NOT NULL                COMMENT '호출 출처',
    `prompt_tokens`     INTEGER       NOT NULL                COMMENT '입력 토큰 수',
    `completion_tokens` INTEGER       NOT NULL                COMMENT '출력 토큰 수',
    `total_tokens`      INTEGER       NOT NULL                COMMENT '총 토큰 수',
    `cost_usd`          DECIMAL(10,6) NOT NULL DEFAULT 0      COMMENT '비용(USD)',
    `created_at`        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    INDEX `ai_usage_log_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='AI 사용량 로그';

ALTER TABLE `ai_usage_log` ADD CONSTRAINT `ai_usage_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- KST 타임스탬프 트리거 (created_at 만 존재)
CREATE TRIGGER `tr_ai_usage_log_bi` BEFORE INSERT ON `ai_usage_log` FOR EACH ROW SET NEW.created_at = NOW();
