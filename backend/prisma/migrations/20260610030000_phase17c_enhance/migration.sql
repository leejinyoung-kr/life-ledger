-- Phase 17c 기존 기능 고도화
-- 알림 수신설정(만기·마감 토글) + 신원 사본 이미지 연동(file_id)

-- 1) user_settings — 만기/마감 알림 토글
ALTER TABLE `user_settings`
    ADD COLUMN `notif_maturity` BOOLEAN NOT NULL DEFAULT true COMMENT '만기/결제 임박 알림 수신' AFTER `notif_upload`,
    ADD COLUMN `notif_deadline` BOOLEAN NOT NULL DEFAULT true COMMENT '만료/마감 임박 알림 수신' AFTER `notif_maturity`;

-- 2) identity_card — 사본 이미지(storage_file FK)
ALTER TABLE `identity_card`
    ADD COLUMN `file_id` INTEGER NULL COMMENT 'storage_file.id FK (사본 이미지)' AFTER `number_enc`,
    ADD CONSTRAINT `identity_card_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `storage_file`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
