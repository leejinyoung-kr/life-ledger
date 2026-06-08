-- Phase 17b 데이터 흐름
-- ENV 변수 값 변경 이력 (버전이력/롤백)

CREATE TABLE `env_var_history` (
    `id`         INTEGER     NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `env_var_id` INTEGER     NOT NULL                COMMENT 'env_var.id FK',
    `user_id`    INTEGER     NOT NULL                COMMENT 'user.id FK',
    `value_enc`  TEXT        NOT NULL                COMMENT '이전 값(암호문)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '기록일(KST)',

    INDEX `env_var_history_env_var_id_created_at_idx`(`env_var_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='ENV 변수 값 변경 이력';

-- KST 타임스탬프 트리거 (created_at 단일)
CREATE TRIGGER `tr_env_var_history_bi` BEFORE INSERT ON `env_var_history` FOR EACH ROW SET NEW.created_at = NOW();
