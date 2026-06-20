-- CreateTable: 투자 계좌 (예수금은 계좌 단위, 종목 여러 개가 공유)
CREATE TABLE `investment_account` (
    `id`           INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`      INTEGER       NOT NULL                COMMENT 'user.id FK',
    `name`         VARCHAR(100)  NOT NULL                COMMENT '계좌명',
    `cash_balance` DECIMAL(15,2) NOT NULL DEFAULT 0       COMMENT '예수금(미투자 대기 현금)',
    `memo`         VARCHAR(300)  NULL                     COMMENT '메모',
    `deleted_at`   DATETIME(3)   NULL                     COMMENT '삭제일(KST)',
    `created_at`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `investment_account_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='투자 계좌';

ALTER TABLE `investment_account`
    ADD CONSTRAINT `investment_account_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 사용자별 기존 종목들의 예수금 합계를 가진 기본 계좌 1개씩 생성
INSERT INTO `investment_account` (`user_id`, `name`, `cash_balance`)
SELECT `user_id`, '일반', COALESCE(SUM(`cash_balance`), 0)
FROM `investment`
GROUP BY `user_id`;

-- AlterTable: investment에 account_id 추가 (우선 NULL 허용 → 백필 → NOT NULL)
ALTER TABLE `investment` ADD COLUMN `account_id` INTEGER NULL COMMENT 'investment_account.id FK';

UPDATE `investment` i
JOIN `investment_account` a ON a.`user_id` = i.`user_id` AND a.`name` = '일반'
SET i.`account_id` = a.`id`;

ALTER TABLE `investment`
    MODIFY `account_id` INTEGER NOT NULL COMMENT 'investment_account.id FK',
    DROP COLUMN `cash_balance`;

ALTER TABLE `investment`
    ADD CONSTRAINT `investment_account_id_fkey`
    FOREIGN KEY (`account_id`) REFERENCES `investment_account`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX `investment_account_id_idx` ON `investment`(`account_id`);

-- 기존 자산이동 거래의 target_id(구 Investment.id) → 해당 사용자의 기본 계좌 id로 재접속
UPDATE `transaction` t
JOIN `investment_account` a ON a.`user_id` = t.`user_id` AND a.`name` = '일반'
SET t.`target_id` = a.`id`
WHERE t.`target_type` = 'investment';
