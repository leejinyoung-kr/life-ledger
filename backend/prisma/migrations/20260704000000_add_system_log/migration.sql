CREATE TABLE `system_log` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`    INTEGER      NULL                   COMMENT '관련 사용자 (전역 이벤트는 null)',
    `level`      VARCHAR(10)  NOT NULL               COMMENT 'info | warn | error',
    `category`   VARCHAR(30)  NOT NULL               COMMENT 'recurring_buy | cron | asset 등',
    `message`    TEXT         NOT NULL               COMMENT '메시지',
    `metadata`   JSON         NULL                   COMMENT '추가 컨텍스트',
    `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일',

    PRIMARY KEY (`id`),
    INDEX `system_log_level_idx`      (`level`),
    INDEX `system_log_category_idx`   (`category`),
    INDEX `system_log_created_at_idx` (`created_at`),
    INDEX `system_log_user_id_idx`    (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='시스템 로그';
