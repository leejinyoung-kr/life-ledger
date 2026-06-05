-- 반복 거래 자동 생성(회차) 지원 컬럼
ALTER TABLE `transaction`
  ADD COLUMN `recurring_parent_id` INT NULL COMMENT '반복 원본 transaction.id (자동 생성 회차)',
  ADD COLUMN `recurring_period` VARCHAR(10) NULL COMMENT '반복 회차 식별 (YYYY-MM / YYYY / YYYY-MM-DD)';

CREATE INDEX `transaction_recurring_parent_id_idx` ON `transaction` (`recurring_parent_id`);
