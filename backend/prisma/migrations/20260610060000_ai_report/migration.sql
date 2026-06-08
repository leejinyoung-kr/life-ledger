-- AI 리포트 (가계부 데이터 분석 - 소비 패턴·절약 인사이트)
CREATE TABLE `ai_report` (
    `id`           INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`      INTEGER       NOT NULL                COMMENT 'user.id FK',
    `period_label` VARCHAR(50)   NOT NULL                COMMENT '분석 기간 표시 라벨',
    `period_from`  DATE          NOT NULL                COMMENT '분석 시작일',
    `period_to`    DATE          NOT NULL                COMMENT '분석 종료일',
    `model_used`   VARCHAR(50)   NOT NULL                COMMENT '생성에 사용한 AI 모델',
    `summary`      VARCHAR(1000) NOT NULL                COMMENT '종합 요약',
    `insights`     JSON          NOT NULL                COMMENT '인사이트 목록(tone·text)',
    `tags`         JSON          NOT NULL                COMMENT '키워드 태그 목록',
    `created_at`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    INDEX `ai_report_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='AI 리포트';

ALTER TABLE `ai_report` ADD CONSTRAINT `ai_report_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- KST 타임스탬프 트리거 (created_at 만 존재)
CREATE TRIGGER `tr_ai_report_bi` BEFORE INSERT ON `ai_report` FOR EACH ROW SET NEW.created_at = NOW();
