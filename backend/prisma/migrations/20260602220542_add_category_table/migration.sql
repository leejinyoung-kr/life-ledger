-- AlterTable
ALTER TABLE `login_session` MODIFY `last_active_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '최근활동(KST)';

-- AlterTable
ALTER TABLE `notification` MODIFY `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '발생시각(화면표시용)';

-- CreateTable: 카테고리 (설정 > 카테고리 관리)
CREATE TABLE `category` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`    INTEGER      NOT NULL                COMMENT 'user.id FK',
    `domain`     ENUM('transaction','subscription','asset','investment','saving') NOT NULL COMMENT '적용 도메인',
    `code`       VARCHAR(50)  NOT NULL                COMMENT '카테고리 코드(영문)',
    `label`      VARCHAR(100) NOT NULL                COMMENT '표시명',
    `sort_order` INTEGER      NOT NULL DEFAULT 0      COMMENT '정렬 순서',
    `is_active`  BOOLEAN      NOT NULL DEFAULT true   COMMENT '활성 여부',
    `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `category_user_id_domain_idx`(`user_id`, `domain`),
    UNIQUE INDEX `category_user_id_domain_code_key`(`user_id`, `domain`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='카테고리';

-- AddForeignKey
ALTER TABLE `category` ADD CONSTRAINT `category_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
