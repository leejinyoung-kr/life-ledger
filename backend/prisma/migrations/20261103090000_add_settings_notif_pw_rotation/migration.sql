-- AlterTable — 비밀번호 교체 권장 알림을 끌 수 있게 한다. 기존 사용자는 켜진 상태로 시작한다
ALTER TABLE `user_settings` ADD COLUMN `notif_pw_rotation` BOOLEAN NOT NULL DEFAULT true COMMENT '비밀번호 교체 권장 알림 수신' AFTER `notif_deadline`;
