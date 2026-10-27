-- AlterTable — 일정마다 당일 오전 9시 알림(푸시)을 받을지. 기존 일정은 꺼진 상태로 시작한다
ALTER TABLE `calendar_event` ADD COLUMN `notify` BOOLEAN NOT NULL DEFAULT false COMMENT '당일 알림 여부' AFTER `recur_until`;
