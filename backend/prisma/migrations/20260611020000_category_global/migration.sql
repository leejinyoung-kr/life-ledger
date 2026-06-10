-- 카테고리 전역 공용화: user_id 제거 → 모든 사용자가 동일 분류표를 공유·편집
-- 1) FK·인덱스·유니크 제거 (user_id 의존분)
ALTER TABLE `category` DROP FOREIGN KEY `category_user_id_fkey`;
DROP INDEX `category_user_id_domain_code_key` ON `category`;
DROP INDEX `category_user_id_domain_idx` ON `category`;
DROP INDEX `category_user_id_domain_parent_code_idx` ON `category`;

-- 2) (domain, code) 전역 중복 제거 — 여러 사용자가 같은 코드 보유 시 최소 id 1건만 유지
DELETE c1 FROM `category` c1
    JOIN `category` c2
        ON c1.`domain` = c2.`domain` AND c1.`code` = c2.`code` AND c1.`id` > c2.`id`;

-- 3) created_by(감사용) 추가 → user_id 값 이관 → user_id 제거
ALTER TABLE `category` ADD COLUMN `created_by` INTEGER NULL COMMENT '생성자 user.id(감사용, FK 아님)' AFTER `is_active`;
UPDATE `category` SET `created_by` = `user_id`;
ALTER TABLE `category` DROP COLUMN `user_id`;

-- 4) 전역 유니크·인덱스 재생성
CREATE UNIQUE INDEX `category_domain_code_key` ON `category`(`domain`, `code`);
CREATE INDEX `category_domain_idx` ON `category`(`domain`);
CREATE INDEX `category_domain_parent_code_idx` ON `category`(`domain`, `parent_code`);
