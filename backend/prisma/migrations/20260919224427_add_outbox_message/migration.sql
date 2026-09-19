-- CreateTable
CREATE TABLE `outbox_message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `channel` VARCHAR(30) NOT NULL COMMENT '발송 수단',
    `payload` TEXT NOT NULL COMMENT '발송에 필요한 값(JSON)',
    `idempotency_key` VARCHAR(200) NOT NULL COMMENT '중복 방지 키 — 도메인 식별자 기반',
    `status` ENUM('pending', 'sending', 'sent', 'failed') NOT NULL DEFAULT 'pending' COMMENT '상태',
    `attempts` INTEGER NOT NULL DEFAULT 0 COMMENT '실패 횟수',
    `max_attempts` INTEGER NOT NULL COMMENT '최대 시도 횟수 — 넘기면 실패 마감',
    `available_at` DATETIME(3) NOT NULL COMMENT '발송 가능일(KST) — 재시도 대기·보류',
    `claimed_until` DATETIME(3) NULL COMMENT '발송 선점 만료일(KST)',
    `last_error` TEXT NULL COMMENT '마지막 실패의 원본 에러',
    `sent_at` DATETIME(3) NULL COMMENT '발송일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL COMMENT '수정일(KST)',

    UNIQUE INDEX `outbox_message_idempotency_key_key`(`idempotency_key`),
    INDEX `outbox_message_status_available_at_idx`(`status`, `available_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='알림 발송 아웃박스';
