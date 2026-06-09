-- 카테고리 2계층(대분류→소분류) 지원 — 소분류에 부모 코드 보관
ALTER TABLE `category`
    ADD COLUMN `parent_code` VARCHAR(50) NULL COMMENT '대분류 code(소분류만, 대분류·단일계층 도메인은 NULL)' AFTER `label`;

CREATE INDEX `category_user_id_domain_parent_code_idx` ON `category`(`user_id`, `domain`, `parent_code`);
