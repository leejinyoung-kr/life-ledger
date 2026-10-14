-- 기존 구독은 어느 로그인 세션 것인지 알 수 없어 지운다 — 옛 주소(docnexus)에서 만든 구독도 여기 섞여 있다.
-- 지금 쓰는 기기는 앱을 열면 다시 등록된다(프론트 syncPushSubscription)
DELETE FROM `push_subscription`;

-- AlterTable
ALTER TABLE `push_subscription` ADD COLUMN `session_id` INTEGER NULL COMMENT 'login_session.id FK';

-- CreateIndex
CREATE INDEX `push_subscription_session_id_idx` ON `push_subscription`(`session_id`);

-- AddForeignKey
ALTER TABLE `push_subscription` ADD CONSTRAINT `push_subscription_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `login_session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
