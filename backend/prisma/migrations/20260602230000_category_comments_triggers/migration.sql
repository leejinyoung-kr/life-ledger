-- category 테이블 컬럼 코멘트 보완 (최초 마이그레이션에서 누락)
ALTER TABLE `category`
    MODIFY `id`         INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    MODIFY `user_id`    INTEGER      NOT NULL                COMMENT 'user.id FK',
    MODIFY `domain`     ENUM('transaction','subscription','asset','investment','saving') NOT NULL COMMENT '적용 도메인',
    MODIFY `code`       VARCHAR(50)  NOT NULL                COMMENT '카테고리 코드(영문)',
    MODIFY `label`      VARCHAR(100) NOT NULL                COMMENT '표시명',
    MODIFY `sort_order` INTEGER      NOT NULL DEFAULT 0      COMMENT '정렬 순서',
    MODIFY `is_active`  BOOLEAN      NOT NULL DEFAULT true   COMMENT '활성 여부',
    MODIFY `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    MODIFY `updated_at` DATETIME(3)  NOT NULL                COMMENT '수정일(KST)';

ALTER TABLE `category` COMMENT='카테고리';

-- KST 타임스탬프 트리거
CREATE TRIGGER `tr_category_bi` BEFORE INSERT ON `category` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_category_bu` BEFORE UPDATE ON `category` FOR EACH ROW SET NEW.updated_at = NOW();
