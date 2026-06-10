-- CreateTable
CREATE TABLE `refresh_token` (
    `id`         INTEGER     NOT NULL AUTO_INCREMENT                  COMMENT '고유번호',
    `user_id`    INTEGER     NOT NULL                                  COMMENT 'user.id FK',
    `session_id` INTEGER     NULL                                      COMMENT 'login_session.id FK',
    `jti`        VARCHAR(36) NOT NULL                                  COMMENT '토큰 식별자(JWT jti)',
    `expires_at` DATETIME(3) NOT NULL                                  COMMENT '만료일(KST)',
    `revoked_at` DATETIME(3) NULL                                      COMMENT '폐기일(KST), null=유효',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)     COMMENT '발급일(KST)',

    UNIQUE INDEX `refresh_token_jti_key`(`jti`),
    INDEX `refresh_token_user_id_idx`(`user_id`),
    INDEX `refresh_token_session_id_idx`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='갱신 토큰 화이트리스트';

-- AddForeignKey
ALTER TABLE `refresh_token` ADD CONSTRAINT `refresh_token_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_token` ADD CONSTRAINT `refresh_token_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `login_session`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTrigger
CREATE TRIGGER `tr_refresh_token_bi` BEFORE INSERT ON `refresh_token` FOR EACH ROW SET NEW.created_at = NOW();
