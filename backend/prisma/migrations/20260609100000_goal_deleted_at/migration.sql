-- goal 테이블에 soft delete 컬럼 추가 (휴지통 연동용)
ALTER TABLE `goal`
  ADD COLUMN `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)';
