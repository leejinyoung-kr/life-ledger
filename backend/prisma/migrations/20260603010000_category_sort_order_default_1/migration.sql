-- category.sort_order 기본값 0 → 1 (1-indexed 정렬)
ALTER TABLE `category`
    MODIFY `sort_order` INTEGER NOT NULL DEFAULT 1 COMMENT '정렬 순서';
