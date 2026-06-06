-- CreateTable: 월별 예산 오버라이드 — 기본 예산(user_settings.budgets) 대신 특정 달에만 다른 금액 적용. 이월 금액도 여기에 보관
CREATE TABLE `monthly_budget` (
    `id`                  INTEGER      NOT NULL AUTO_INCREMENT                        COMMENT '고유번호',
    `user_id`             INTEGER      NOT NULL                                       COMMENT 'user.id FK',
    `year_month`          VARCHAR(7)   NOT NULL                                       COMMENT '예산 적용 월(YYYY-MM)',
    `category`            VARCHAR(50)  NOT NULL                                       COMMENT '카테고리 코드(food·transport…)',
    `amount`              INTEGER      NOT NULL                                       COMMENT '이 달 오버라이드 예산(원, 0=기본값 유지)',
    `carried_over_amount` INTEGER      NOT NULL DEFAULT 0                             COMMENT '전달 잔여 이월 금액(원)',
    `created_at`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)         COMMENT '생성일(KST)',
    `updated_at`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    UNIQUE INDEX `uq_user_yearmonth_category`(`user_id`, `year_month`, `category`),
    INDEX `idx_monthly_budget_user_month`(`user_id`, `year_month`),
    CONSTRAINT `monthly_budget_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='월별 예산 오버라이드 및 이월';
