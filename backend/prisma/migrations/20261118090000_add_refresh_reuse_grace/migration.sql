-- AlterTable — 회전으로 폐기된 refresh 토큰에 받은 새 토큰 jti 를 남긴다. 15초 안 재사용은 그 새 토큰으로 이어 주고, 지나면 세션을 끊는다
ALTER TABLE `refresh_token` ADD COLUMN `replaced_by` VARCHAR(36) NULL COMMENT '회전으로 받은 새 토큰 jti' AFTER `revoked_at`;

-- AlterTable — 재사용 허용 · 감지를 접근 기록에 남긴다
ALTER TABLE `access_log` MODIFY `action` ENUM('cred_reveal', 'cred_totp', 'cred_backup', 'backup_codes_generate', 'vault_unlock', 'vault_disable', 'session_revoke', 'data_export', 'refresh_grace', 'refresh_reuse') NOT NULL COMMENT '열람 동작';
