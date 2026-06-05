-- 사이드바 1차 메뉴 순서 (key 배열 JSON, null=기본순서)
ALTER TABLE `user_settings`
  ADD COLUMN `menu_order` JSON NULL COMMENT '사이드바 1차 메뉴 순서(key 배열)';
