-- AlterTable
ALTER TABLE `user_settings` ADD COLUMN `show_holidays` BOOLEAN NOT NULL DEFAULT true COMMENT '캘린더에 공휴일·대체공휴일 표시 여부';

-- CreateTable
CREATE TABLE `holiday` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `date` DATE NOT NULL COMMENT '공휴일 날짜',
    `name` VARCHAR(100) NOT NULL COMMENT '공휴일명 (대체공휴일은 원본 명칭 그대로, is_substitute로 구분)',
    `is_substitute` BOOLEAN NOT NULL DEFAULT false COMMENT '대체공휴일 여부',
    `year` INTEGER NOT NULL COMMENT '조회 연도(solYear 기준, 캐시 갱신 단위)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    INDEX `holiday_year_idx`(`year`),
    UNIQUE INDEX `holiday_date_name_key`(`date`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='공휴일·대체공휴일 (전 사용자 공용 캐시)';
