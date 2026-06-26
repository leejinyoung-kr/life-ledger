-- AlterTable
ALTER TABLE `investment` ADD COLUMN `symbol` VARCHAR(20) NULL COMMENT '시세조회용 종목코드(국내) 또는 티커(해외)';
