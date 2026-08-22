-- 기존에 target_type='asset'(부동산/부채)로 연동돼 있던 거래/자동이체 행은
-- 대상 테이블(asset)이 삭제되기 전에 연동을 끊어 "단순 기록"으로 전환한다.
-- (ENUM에서 'asset' 값을 제거하는 MODIFY COLUMN이 이 값을 쓰는 행이 남아있으면 실패하므로 반드시 선행)
UPDATE `transaction` SET `target_type` = NULL, `target_id` = NULL, `target_direction` = NULL WHERE `target_type` = 'asset';
UPDATE `recurring_schedule` SET `target_type` = NULL, `target_id` = NULL, `target_direction` = NULL WHERE `target_type` = 'asset';

-- DropForeignKey (dropping the table below removes this automatically, listed for clarity)
-- ALTER TABLE `asset` DROP FOREIGN KEY `asset_user_id_fkey`;

-- DropTable
DROP TABLE `asset`;

-- AlterTable: transaction — drop target_direction, drop 'asset' from target_type enum
ALTER TABLE `transaction`
  MODIFY `target_type` ENUM('saving', 'investment') NULL COMMENT '이동 대상 종류(transfer 전용)',
  DROP COLUMN `target_direction`;

-- AlterTable: recurring_schedule — drop target_direction, drop 'asset' from target_type enum
ALTER TABLE `recurring_schedule`
  MODIFY `target_type` ENUM('saving', 'investment') NULL COMMENT '이동 대상 종류(kind=transaction, transfer 전용)',
  DROP COLUMN `target_direction`;
