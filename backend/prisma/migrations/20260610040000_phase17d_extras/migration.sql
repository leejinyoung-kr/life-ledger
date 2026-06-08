-- Phase 17d 신규 제안
-- 파일 업로드 보강 — SHA-256 해시(동일 내용 중복 제거)

ALTER TABLE `storage_file`
    ADD COLUMN `hash` VARCHAR(64) NULL COMMENT 'SHA-256(동일 내용 중복 제거용)' AFTER `mime_type`,
    ADD INDEX `storage_file_user_id_hash_idx`(`user_id`, `hash`);
