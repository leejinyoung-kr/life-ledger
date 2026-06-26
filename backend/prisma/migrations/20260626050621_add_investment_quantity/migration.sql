-- AlterTable
ALTER TABLE `investment` ADD COLUMN `quantity` DECIMAL(18, 6) NULL COMMENT '보유수량 — 시세조회 시 평가금액 계산에 사용';
