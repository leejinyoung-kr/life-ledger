-- CreateTable
CREATE TABLE `job_run` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `job` VARCHAR(100) NOT NULL COMMENT '작업 이름',
    `triggered_by` ENUM('schedule', 'manual') NOT NULL COMMENT '실행 계기',
    `status` ENUM('running', 'succeeded', 'failed') NOT NULL COMMENT '상태',
    `started_at` DATETIME(3) NOT NULL COMMENT '시작일(KST)',
    `lease_until` DATETIME(3) NOT NULL COMMENT '점유 만료일(KST) — 이때까지 끝나지 않으면 실패 마감',
    `finished_at` DATETIME(3) NULL COMMENT '종료일(KST)',
    `summary` VARCHAR(500) NULL COMMENT '작업 요약',
    `error` TEXT NULL COMMENT '원본 에러',
    `running_key` VARCHAR(100) NULL COMMENT '실행 중인 작업 이름 — 같은 작업 동시 실행 방지',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    UNIQUE INDEX `job_run_running_key_key`(`running_key`),
    INDEX `job_run_job_started_at_idx`(`job`, `started_at`),
    INDEX `job_run_status_lease_until_idx`(`status`, `lease_until`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='예약 작업 실행 기록';
