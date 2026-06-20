-- AlterTable
ALTER TABLE `transaction` ADD COLUMN `target_direction` ENUM('increase', 'decrease') NULL COMMENT '잔액 변화 방향(asset 전용)';
