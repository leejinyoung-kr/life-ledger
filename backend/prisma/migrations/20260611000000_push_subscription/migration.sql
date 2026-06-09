-- 웹 푸시 구독 (PWA Web Push - 브라우저 푸시 서비스 endpoint + 암복호화 키)
CREATE TABLE `push_subscription` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`    INTEGER      NOT NULL                COMMENT 'user.id FK',
    `endpoint`   VARCHAR(500) NOT NULL                COMMENT '브라우저 푸시 서비스 엔드포인트 URL',
    `p256dh`     VARCHAR(255) NOT NULL                COMMENT '페이로드 암호화용 공개키(Base64URL)',
    `auth`       VARCHAR(255) NOT NULL                COMMENT '페이로드 인증 시크릿(Base64URL)',
    `user_agent` VARCHAR(300) NULL                    COMMENT '구독 생성 기기 식별용(선택)',
    `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    UNIQUE INDEX `push_subscription_endpoint_key`(`endpoint`),
    INDEX `push_subscription_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='웹 푸시 구독';

ALTER TABLE `push_subscription` ADD CONSTRAINT `push_subscription_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- KST 타임스탬프 트리거 (created_at 만 존재)
CREATE TRIGGER `tr_push_subscription_bi` BEFORE INSERT ON `push_subscription` FOR EACH ROW SET NEW.created_at = NOW();
